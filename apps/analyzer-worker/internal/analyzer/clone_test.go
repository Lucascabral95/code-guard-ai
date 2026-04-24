package analyzer

import "testing"

func TestValidateGitHubURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		rawURL  string
		wantErr bool
	}{
		{name: "valid repository", rawURL: "https://github.com/vercel/next.js", wantErr: false},
		{name: "valid git suffix", rawURL: "https://github.com/vercel/next.js.git", wantErr: false},
		{name: "wrong host", rawURL: "https://example.com/vercel/next.js", wantErr: true},
		{name: "wrong scheme", rawURL: "http://github.com/vercel/next.js", wantErr: true},
		{name: "missing repo", rawURL: "https://github.com/vercel", wantErr: true},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			err := ValidateGitHubURL(test.rawURL)
			if test.wantErr && err == nil {
				t.Fatalf("expected error")
			}
			if !test.wantErr && err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
		})
	}
}
