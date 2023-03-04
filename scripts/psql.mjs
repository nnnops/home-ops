#!/usr/bin/env zx
$.verbose = false;

// find random open port
const pgPort = 23111;

var bufferStream = new require("stream").PassThrough();
// kube port-forward postgres-rw.databases.svc.cluster.local 5432
const kbForward = $`kubectl port-forward --namespace databases svc/postgres-any ${pgPort}:5432`;
kbForward.pipe(bufferStream);

const openYaml = async (path) => {
  return YAML.parse((await $`sops --decrypt $DEVENV_ROOT/${path}`).stdout)
    .stringData;
};

try {
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

  const { username: pgAdminUsername, password: pgAdminPassword } =
    await openYaml("cluster/core/databases/postgres/cluster/secret.enc.yaml");

  $.verbose = true;
  process.env.PGPASSWORD = pgAdminPassword;
  const psql = $`psql -h localhost -p ${pgPort} -U ${pgAdminUsername} -d postgres`;
  psql.stdio(process.stdin, process.stdout, process.stdout);
  await psql;
} catch (e) {
  throw e;
} finally {
  kbForward.kill("SIGINT");
  await kbForward;
}
