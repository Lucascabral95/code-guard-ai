package analyzer

import (
	"encoding/json"
	"fmt"
	"os"
)

type PackageJSON struct {
	Scripts map[string]string `json:"scripts"`
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
	return manifest, nil
}
