{
  description = "Description for the project";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    devenv.url = "github:cachix/devenv";
    nix2container.url = "github:nlewo/nix2container";
    nix2container.inputs.nixpkgs.follows = "nixpkgs";
    mk-shell-bin.url = "github:rrbutani/nix-mk-shell-bin";
  };

  nixConfig = {
    extra-trusted-public-keys =
      "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=";
    extra-substituters = "https://devenv.cachix.org";
  };

  outputs = inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [ inputs.devenv.flakeModule ];
      systems = [
        "x86_64-linux"
        "i686-linux"
        "x86_64-darwin"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      perSystem = { config, self', inputs', pkgs, system, ... }: {
        _module.args.pkgs = import inputs.nixpkgs {
          inherit system;
          config.allowUnfreePredicate = pkg:
            builtins.elem (inputs.nixpkgs.lib.getName pkg)
            [ "terraform-1.6.6" ];
          config.allowUnfree = true;
        };

        # Per-system attributes can be defined here. The self' and inputs'
        # module parameters provide easy access to attributes of the same
        # system.

        # Equivalent to  inputs'.nixpkgs.legacyPackages.hello;
        packages.volsync = pkgs.buildGoModule rec {
          pname = "kubectl-volsync";
          version = "0.5.0";

          src = pkgs.fetchFromGitHub {
            owner = "backube";
            repo = "volsync";
            rev = "v${version}";
            sha256 = "sha256-OLrDqzVndyx0Yg/x21DRL/Or4VBJLGncQ8UwXylR/DE=";
          };

          subPackages = [ "kubectl-volsync" ];

          vendorSha256 = "sha256-z/DJeJiJ8YIr1wpKeCpp9wh62hscgoV1MYyd9bUGrNY=";
        };

        devenv.shells.default = {
          name = "nnn-ops";

          imports = [
            # This is just like the imports in devenv.nix.
            # See https://devenv.sh/guides/using-with-flake-parts/#import-a-devenv-module
            # ./devenv-foo.nix
          ];

          # https://devenv.sh/reference/options/

          packages = [
            pkgs.nodePackages.zx

            pkgs.sops
            pkgs.age
            pkgs.gnumake

            pkgs.fluxcd
            pkgs.kubectl
            pkgs.k9s
            pkgs.kubernetes-helm
            pkgs.kyverno

            pkgs.kopia
            pkgs.pwgen

            pkgs.terraform
            pkgs.jq
            pkgs.ansible

            pkgs.nixfmt

            pkgs.postgresql
            pkgs.openssl

          ] ++ (if pkgs.stdenv.isDarwin then
            [ ]
          else
            [ config.packages.volsync ]);

          languages.nix.enable = true;
          languages.terraform.enable = true;
          languages.go.enable = true;
          scripts = {
            delete-crds.exec = "$DEVENV_ROOT/scripts/delete-crds.mjs";
            edit-volume.exec = "$DEVENV_ROOT/scripts/edit-volume.mjs $@";
            manual.exec = "$DEVENV_ROOT/scripts/manual.mjs $@";
            password.exec = "$DEVENV_ROOT/scripts/password.mjs";
            push.exec = "$DEVENV_ROOT/scripts/push.mjs";
            reset-failures.exec = "$DEVENV_ROOT/scripts/reset-failures.mjs";
            gen-kust.exec =
              "${pkgs.kustomize}/bin/kustomize create --autodetect --recursive";
            tf.exec = "$DEVENV_ROOT/scripts/terraform.mjs $@";
            db.exec = "$DEVENV_ROOT/scripts/psql.mjs";
            helm-diff.exec = "$DEVENV_ROOT/scripts/helm-release-diff.mjs $@";
          };

        };

      };
    };
}
