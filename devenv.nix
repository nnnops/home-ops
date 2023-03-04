{ pkgs, lib, ... }:
let
volsync = pkgs.buildGoModule rec {
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
in
{
  # https://devenv.sh/packages/
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

      pkgs.postgresql
      pkgs.openssl
   ] ++ (if pkgs.stdenv.isDarwin then [] else [volsync])
   ;

  # https://devenv.sh/languages/
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
    gen-kust.exec = "${pkgs.kustomize}/bin/kustomize create --autodetect --recursive";
    tf.exec = "$DEVENV_ROOT/scripts/terraform.mjs $@";
    db.exec = "$DEVENV_ROOT/scripts/psql.mjs";
    helm-diff.exec = "$DEVENV_ROOT/scripts/helm-release-diff.mjs $@";
  };
}
