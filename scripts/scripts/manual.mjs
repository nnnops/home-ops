#!/usr/bin/env zx
$.verbose = false;

const isDry = "dry" in argv;
console.log(argv);
const fileName = argv._[0];
if (!fileName) {
  console.error("No file specified");
  process.exit(1);
}

let repo = argv.repo;
let helmPath = argv.path;

const settingsFile = path.join(
  __dirname,
  "../cluster/config/cluster-settings.yaml"
);
const secretsFile = path.join(
  __dirname,
  "../cluster/config/cluster-secrets.enc.yaml"
);
const settings = YAML.parse((await $`cat ${settingsFile}`).stdout).data;
const secrets = YAML.parse(
  (await $`sops --decrypt ${secretsFile}`).stdout
).stringData;
const env = { ...secrets, ...settings };

const fileSource = (await $`cat ${fileName}`).stdout;
let file = YAML.parse(fileSource);

const namespace = file.metadata.namespace;
const name = file.metadata.name;

let url;
let chart;
let version;

if (!repo && !helmPath) {
  repo = file.spec.chart.spec.sourceRef.name;
  chart = file.spec.chart.spec.chart;
  version = file.spec.chart.spec.version;
  const exists =
    JSON.parse((await $`helm repo list -o json`).stdout).filter(
      ({ name }) => name == repo
    ).length > 0;
  if (!exists) {
    console.error(`Repository ${repo} does not exist`);
    process.exit(1);
  }
  url = `${repo}/${chart}`;
} else if (!helmPath) {
  url = `${repo}/${chart}`;
} else {
  url = helmPath;
}

let values = YAML.stringify(file.spec.values).toString();
console.log(values);
for (const key of Object.keys(env)) {
  values = values.split("${" + key + "}").join(env[key]);
}

const unfound = values.split("\n").filter((line) => line.includes("${"));
if (unfound.length > 0) {
  console.error(`Unfound variables: ${unfound}`);
  process.exit(1);
}

const tmpFile =
  (await $`mktemp -d /tmp/tmp.XXXXXXXXXX`).stdout.trim() + "/values.yaml";
console.log(tmpFile);
await fs.writeFile(tmpFile, values);

// cat and echo tmpfile
console.log((await $`cat ${tmpFile}`).stdout);
const versionFlag = version ? ["--version", version] : "";

let cmd;
const dryFlag = isDry ? ["--dry-run", "--debug"] : "";
// if (isDry) {
//   cmd = $`helm template ${name} ${url} --debug ${versionFlag} --namespace ${namespace} --values ${tmpFile}`;
//   console.log(
//     `helm template ${name} ${url} --debug ${versionFlag} --namespace ${namespace} --values ${tmpFile}`
//   );
// } else {
const installed =
  (await $`helm list --namespace ${namespace}`).stdout
    .split("\n")
    .filter((line) => line.includes(name)).length > 0;

console.log((await $`helm list --namespace ${namespace}`).stdout);
// process.exit(1);

cmd = $`helm template ${name} ${url} ${versionFlag} --validate --namespace ${namespace} --values ${tmpFile}`;
//  | kubectl apply -n ${namespace} -f -`;

// cmd = $`helm ${installed ? "upgrade" : "install"} ${name} ${url} ${
//   isDry ? ["--debug", "--dry-run"] : ""
// } --version ${version} --reset-values --namespace ${namespace} --values ${tmpFile}`;

console.log(YAML.parseAllDocuments((await cmd).stdout));

await $`kubectl -n ${namespace} annotate deployment ${name} meta.helm.sh/release-name=${name} --overwrite`;
await $`kubectl -n ${namespace} annotate deployment ${name} meta.helm.sh/release-namespace=${namespace} --overwrite`;