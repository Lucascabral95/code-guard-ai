package analyzer

import (
	"encoding/json"
	"fmt"
	"os"
)

type PackageJSON struct {
	Name            string            `json:"name"`
	Version         string            `json:"version"`
	Scripts         map[string]string `json:"scripts"`
	Dependencies    map[string]string `json:"dependencies"`
	DevDependencies map[string]string `json:"devDependencies"`
	Engines         map[string]string `json:"engines"`
	License         any               `json:"license"`
}

func ParsePackageJSON(path string) (PackageJSON, error) {
	file, err := os.Open(path)
	if err != nil {
		return PackageJSON{}, err
	}
	defer file.Close()

	var manifest PackageJSON
	if err := json.NewDecoder(file).Decode(&manifest); err != nil {
		return PackageJSON{}, fmt.Errorf("parse package.json: %w", err)
	}
	if manifest.Scripts == nil {
		manifest.Scripts = map[string]string{}
	}
	if manifest.Dependencies == nil {
		manifest.Dependencies = map[string]string{}
	}
	if manifest.DevDependencies == nil {
		manifest.DevDependencies = map[string]string{}
	}
	if manifest.Engines == nil {
		manifest.Engines = map[string]string{}
	}
	return manifest, nil
}
