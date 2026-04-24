package sandbox

import (
	"context"
	"fmt"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type DockerExecutor struct{}

func NewDockerExecutor() DockerExecutor {
	return DockerExecutor{}
}

func (executor DockerExecutor) Execute(
	_ context.Context,
	_ string,
	_ string,
) (contracts.AnalysisResult, error) {
	return contracts.AnalysisResult{}, fmt.Errorf("docker sandbox execution is not implemented yet")
}
