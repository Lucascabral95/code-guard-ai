package analyzer

import (
	"bytes"
	"context"
	"fmt"
	"net/url"
	"os/exec"
	"strings"
	"time"
)

func ValidateGitHubURL(rawURL string) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid repository URL: %w", err)
	}

	pathParts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if parsed.Scheme != "https" || parsed.Hostname() != "github.com" || len(pathParts) < 2 {
		return fmt.Errorf("only https://github.com/<owner>/<repo> URLs are supported")
	}

	return nil
}

func CloneRepository(
	ctx context.Context,
	repoURL string,
	branch string,
	destination string,
	timeout time.Duration,
) error {
	if err := ValidateGitHubURL(repoURL); err != nil {
		return err
	}

	if branch == "" {
		branch = "main"
	}

	cloneCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	if err := runGitClone(cloneCtx, []string{"clone", "--depth=1", "--branch", branch, repoURL, destination}); err == nil {
		return nil
	}

	fallbackCtx, fallbackCancel := context.WithTimeout(ctx, timeout)
	defer fallbackCancel()
	return runGitClone(fallbackCtx, []string{"clone", "--depth=1", repoURL, destination})
}

func runGitClone(ctx context.Context, args []string) error {
	command := exec.CommandContext(ctx, "git", args...)
	var stderr bytes.Buffer
	command.Stderr = &stderr

	if err := command.Run(); err != nil {
		detail := strings.TrimSpace(stderr.String())
		if detail == "" {
			detail = err.Error()
		}
		return fmt.Errorf("git clone failed: %s", detail)
	}

	return nil
}
