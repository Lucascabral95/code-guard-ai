package analyzer

import (
	"context"
	"time"

	"github.com/codeguard-ai/codeguard/apps/analyzer-worker/pkg/contracts"
)

type Stage string

const (
	StageClone          Stage = "clone"
	StageDetect         Stage = "detect"
	StageSBOM           Stage = "sbom"
	StageDependencyScan Stage = "dependency-scan"
	StageSAST           Stage = "sast"
	StageSecrets        Stage = "secrets"
	StageIaC            Stage = "iac"
	StageScorecard      Stage = "scorecard"
	StageQuality        Stage = "quality"
	StageNormalize      Stage = "normalize"
	StageReport         Stage = "report"
)

type RepositoryMetadata struct {
	AnalysisID string
	ScanID     string
	RepoURL    string
	Branch     string
	Stack      string
	SafeMode   bool
}

type PluginRunResult struct {
	Tool       string
	Stage      Stage
	Status     string
	Duration   time.Duration
	ExitCode   *int
	Raw        map[string]any
	Stdout     string
	Stderr     string
	Artifacts  []contracts.Artifact
	Components []contracts.Component
}

type AnalyzerPlugin interface {
	Name() string
	Stage() Stage
	Run(ctx context.Context, repoPath string, metadata RepositoryMetadata) (PluginRunResult, error)
	Normalize(result PluginRunResult) (contracts.AnalysisResult, error)
}

type PluginRegistry struct {
	plugins []AnalyzerPlugin
}

func NewPluginRegistry(plugins ...AnalyzerPlugin) PluginRegistry {
	return PluginRegistry{plugins: plugins}
}

func (registry PluginRegistry) Plugins() []AnalyzerPlugin {
	plugins := make([]AnalyzerPlugin, len(registry.plugins))
	copy(plugins, registry.plugins)
	return plugins
}

func (registry PluginRegistry) ByStage(stage Stage) []AnalyzerPlugin {
	plugins := []AnalyzerPlugin{}
	for _, plugin := range registry.plugins {
		if plugin.Stage() == stage {
			plugins = append(plugins, plugin)
		}
	}
	return plugins
}
