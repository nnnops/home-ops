#!/usr/bin/env zx
$.verbose = false;

// find random open port
const pgPort = 23111;

var bufferStream = new require("stream").PassThrough();
// kube port-forward postgres-rw.databases.svc.cluster.local 5432
const kbForward = $`kubectl port-forward --namespace databases svc/postgres-rw ${pgPort}:5432`.pipe(bufferStream);

const openYaml = async (path) => {
  return YAML.parse((await $`sops --decrypt $DEVENV_ROOT/${path}`).stdout)
    .stringData;
};

try {
  // decrypt terraform state
  await $`sops --decrypt $DEVENV_ROOT/terraform/terraform.enc.tfstate > $DEVENV_ROOT/terraform/terraform.tfstate`;

  const secrets = await openYaml("cluster/config/cluster-secrets.enc.yaml");

  // wait until stdout provides "Forwarding from"
  outer: while (true) {
    console.log("Waiting for port-forward");
    for await (const chunk of bufferStream) {
      console.log("chunk", chunk.toString());
      if (chunk.toString().match(/Forwarding from \[::1\]/)) {
        break outer;
      }
    }
    await sleep(1000);
  }
  await sleep(1000);
  console.log("Starting port-forward");

  //   port            = var.pg_port
  //   username        = var.pg_user
  //   password        = var.pg_password

  let tfVars = [];
  tfVars.push(`-var=pg_port=${pgPort}`);

  const { username: pgAdminUsername, password: pgAdminPassword } =
    await openYaml("cluster/core/databases/postgres/cluster/secret.enc.yaml");
  tfVars.push(`-var=pg_user=${pgAdminUsername}`);
  tfVars.push(`-var=pg_password=${pgAdminPassword}`);

  const autheliaUser = secrets.SECRET_AUTHELIA_POSTGRES_USERNAME;
  const autheliaPassword = secrets.SECRET_AUTHELIA_POSTGRES_PASSWORD;
  const autheliaDb = secrets.SECRET_AUTHELIA_POSTGRES_DATABASE;
  tfVars.push(`-var=authelia_pg_user=${autheliaUser}`);
  tfVars.push(`-var=authelia_pg_password=${autheliaPassword}`);
  tfVars.push(`-var=authelia_pg_db=${autheliaDb}`);

  const hassSecrets = await openYaml(
    "cluster/apps/home/home-assistant/home-assistant-secrets.enc.yaml"
  );
  const hassDbUrl = new URL(hassSecrets.HASS_DATABASE_URL);
  const hassDbUser = hassDbUrl.username;
  const hassDbPassword = hassDbUrl.password;
  const hassDbName = hassDbUrl.pathname.replace("/", "");
  tfVars.push(`-var=hass_pg_user=${hassDbUser}`);
  tfVars.push(`-var=hass_pg_password=${hassDbPassword}`);
  tfVars.push(`-var=hass_pg_db=${hassDbName}`);

  // gitea
  const giteaSecrets = await openYaml(
    "cluster/apps/dev/gitea/secrets.enc.yaml"
  );
  const giteaUser = giteaSecrets.dbUser;
  const giteaPassword = giteaSecrets.dbPassword;
  const giteaDb = "gitea";
  const giteaS3AccessKey = giteaSecrets.minioAccessKeyId;
  const giteaS3SecretKey = giteaSecrets.minioSecretAccessKey;
  tfVars.push(`-var=gitea_pg_user=${giteaUser}`);
  tfVars.push(`-var=gitea_pg_password=${giteaPassword}`);
  tfVars.push(`-var=gitea_pg_db=${giteaDb}`);
  tfVars.push(`-var=gitea_access_key=${giteaS3AccessKey}`);
  tfVars.push(`-var=gitea_secret_key=${giteaS3SecretKey}`);

  // loki
  const lokiSecrets = await openYaml(
    "cluster/apps/monitoring/loki/secrets.enc.yaml"
  );
  const lokiS3AccessKey = lokiSecrets.AWS_ACCESS_KEY_ID;
  const lokiS3SecretKey = lokiSecrets.AWS_SECRET_ACCESS_KEY;
  tfVars.push(`-var=loki_access_key=${lokiS3AccessKey}`);
  tfVars.push(`-var=loki_secret_key=${lokiS3SecretKey}`);

  // longhorn
  const longhornBackupSecrets = await openYaml(
    "cluster/core/longhorn/secret.enc.yaml"
  );
  const longhornS3AccessKey = longhornBackupSecrets.AWS_ACCESS_KEY_ID;
  const longhornS3SecretKey = longhornBackupSecrets.AWS_SECRET_ACCESS_KEY;
  tfVars.push(`-var=longhorn_access_key=${longhornS3AccessKey}`);
  tfVars.push(`-var=longhorn_secret_key=${longhornS3SecretKey}`);

  // minio
  const minioAccessKey = secrets.SECRET_MINIO_ADMIN_USER;
  const minioSecretKey = secrets.SECRET_MINIO_ADMIN_PASSWORD;
  const domain = secrets.SECRET_DOMAIN;
  const minioServer = `s3.${domain}`;
  tfVars.push(`-var=minio_user=${minioAccessKey}`);
  tfVars.push(`-var=minio_password=${minioSecretKey}`);
  tfVars.push(`-var=minio_server=${minioServer}`);

  // restic_backups
  const resticAccessKey = secrets.SECRET_RESTIC_AWS_ACCESS_KEY_ID;
  const resticSecretKey = secrets.SECRET_RESTIC_AWS_SECRET_ACCESS_KEY;

  tfVars.push(`-var=restic_backups_access_key=${resticAccessKey}`);
  tfVars.push(`-var=restic_backups_secret_key=${resticSecretKey}`);

  // terraform apply $DEVENV_ROOT/terraform/fd
  $.verbose = true;
  console.log(tfVars.join(" "));
  const arg = argv._.length > 0 ? argv._ : ["apply", "-auto-approve"];
  const tf = $`terraform -chdir=$DEVENV_ROOT/terraform/ ${arg} ${tfVars}`;
  tf.stdio(process.stdin, process.stdout, process.stdout);
  await tf;
} catch (e) {
  throw e;
} finally {
  // encrypt terraform state
  await $`sops --encrypt $DEVENV_ROOT/terraform/terraform.tfstate > $DEVENV_ROOT/terraform/terraform.enc.tfstate`;

  kbForward.kill("SIGINT");
  await kbForward;
}
