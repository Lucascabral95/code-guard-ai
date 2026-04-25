package sandbox

import (
	"context"
	"errors"
	"fmt"
	"os/exec"
	"path"
	"path/filepath"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/internal/config"
)

const defaultOutputLimitBytes = 4 * 1024 * 1024

type DockerExecutor struct {
	memoryLimit      string
	cpuLimit         string
	outputLimitBytes int
	networkMode      string
	sharedVolume     string
	workspacePath    string
}

type DockerRunResult struct {
	Stdout     string
	Stderr     string
	ExitCode   int
	DurationMs int
}

func NewDockerExecutor(cfg config.Config) DockerExecutor {
	outputLimitBytes := cfg.ScannerOutputLimitBytes
	if outputLimitBytes <= 0 {
		outputLimitBytes = defaultOutputLimitBytes
	}

	workspacePath := cfg.ScannerWorkspacePath
	if workspacePath == "" {
		workspacePath = "/workspace"
	}

	return DockerExecutor{
		memoryLimit:      cfg.ScannerMemoryLimit,
		cpuLimit:         cfg.ScannerCPULimit,
		outputLimitBytes: outputLimitBytes,
		networkMode:      cfg.ScannerDockerNetwork,
		sharedVolume:     cfg.ScannerSharedVolume,
		workspacePath:    workspacePath,
	}
}

func (executor DockerExecutor) RunTool(
	ctx context.Context,
	repoPath string,
	image string,
	args ...string,
) (DockerRunResult, error) {
	if image == "" {
		return DockerRunResult{}, errors.New("docker image is required")
	}

	startedAt := time.Now()
	commandArgs, err := executor.buildCommandArgs(repoPath, image, args...)
	if err != nil {
		return DockerRunResult{}, err
	}

	command := exec.CommandContext(ctx, "docker", commandArgs...)
	stdout := newLimitedBuffer(executor.outputLimitBytes)
	stderr := newLimitedBuffer(executor.outputLimitBytes)
	command.Stdout = stdout
	command.Stderr = stderr

	err = command.Run()
	exitCode := 0
	if err != nil {
		if ctx.Err() != nil {
			return DockerRunResult{}, fmt.Errorf("docker execution timed out: %w", ctx.Err())
		}

		var exitError *exec.ExitError
		if errors.As(err, &exitError) {
			exitCode = exitError.ExitCode()
		} else {
			return DockerRunResult{}, fmt.Errorf("run docker sandbox: %w", err)
		}
	}

	return DockerRunResult{
		Stdout:     stdout.String(),
		Stderr:     stderr.String(),
		ExitCode:   exitCode,
		DurationMs: int(time.Since(startedAt).Milliseconds()),
	}, nil
}

func (executor DockerExecutor) buildCommandArgs(
	repoPath string,
	image string,
	args ...string,
) ([]string, error) {
	repoMount, workDir, err := executor.repoMount(repoPath)
	if err != nil {
		return nil, err
	}

	commandArgs := []string{"run", "--rm"}
	if executor.networkMode != "" {
		commandArgs = append(commandArgs, "--network", executor.networkMode)
	}
	if executor.memoryLimit != "" {
		commandArgs = append(commandArgs, "--memory", executor.memoryLimit)
	}
	if executor.cpuLimit != "" {
		commandArgs = append(commandArgs, "--cpus", executor.cpuLimit)
	}

	commandArgs = append(
		commandArgs,
		"-v",
		repoMount,
		"-w",
		workDir,
		image,
	)
	commandArgs = append(commandArgs, args...)
	return commandArgs, nil
}

func (executor DockerExecutor) repoMount(repoPath string) (string, string, error) {
	if executor.sharedVolume != "" {
		repoDir := filepath.Base(filepath.Clean(repoPath))
		if repoDir == "." || repoDir == string(filepath.Separator) || repoDir == "" {
			return "", "", fmt.Errorf("invalid repository path for shared volume: %s", repoPath)
		}

		return fmt.Sprintf(
				"%s:%s:ro",
				executor.sharedVolume,
				executor.workspacePath,
			),
			path.Join(executor.workspacePath, repoDir),
			nil
	}

	if repoPath == "" {
		return "", "", errors.New("repository path is required")
	}

	containerRepoPath := path.Join(executor.workspacePath, "repo")
	return fmt.Sprintf("%s:%s:ro", repoPath, containerRepoPath), containerRepoPath, nil
}

type limitedBuffer struct {
	limit int
	data  []byte
}

func newLimitedBuffer(limit int) *limitedBuffer {
	return &limitedBuffer{limit: limit}
}

func (buffer *limitedBuffer) Write(input []byte) (int, error) {
	remaining := buffer.limit - len(buffer.data)
	if remaining > 0 {
		if len(input) <= remaining {
			buffer.data = append(buffer.data, input...)
		} else {
			buffer.data = append(buffer.data, input[:remaining]...)
		}
	}
	return len(input), nil
}

func (buffer *limitedBuffer) String() string {
	return string(buffer.data)
}
