#!/usr/bin/env zx

const namespace = argv['n'] || argv['namespace'];
if (!namespace) {
  console.error("Please specify namespace: -n monitoring or --namespace monitoring")
  process.exit(1);
}

const volume = argv._[0];
if (!volume) {
  console.error("Please specify pvc name.")
  process.exit(1);
}

const image = "busybox";


const name = `edit-${volume}`;

const volumeName = "volume"

const overrides = {
  metadata: {
    name
  },
  spec: {
    containers: [
      {
        name: "edit",
        image,
        stdin: true,
        stdinOnce: true,
        tty: true,
        args: ["sh"],
        volumeMounts: [{
          mountPath: "/config",
          name: volumeName
        }]
      }
    ],
    volumes: [{
      name: volumeName,
      persistentVolumeClaim: {
        claimName: volume
      }
    }]
  }

}

const flags = !argv['dry'] ? ['--tty', '-i', '--rm'] : ['--dry-run', 'client', '-o', 'json'];

console.log("Creating and opening pod: ", name);

$`kubectl run ${flags} -n ${namespace} --overrides=${JSON.stringify(overrides)} --image=${image} --restart=Never -- sh`;


