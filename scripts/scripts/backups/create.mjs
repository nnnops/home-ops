#!/usr/bin/env zx
function backupCode(pathInput, appName, namespace, pvc, method="Clone") {
  const yamlPath = path.join($.env["DEVENV_ROOT"], "/cluster/", pathInput);

  const code = `apiVersion: v1
kind: Secret
metadata:
  name: restic-config-backup-${appName}
  namespace: ${namespace}
type: Opaque
stringData:
  RESTIC_REPOSITORY: \${BACKUP_RESTIC_PATH}/${appName}
  RESTIC_PASSWORD: \${SECRET_RESTIC_PASSWORD}
  AWS_ACCESS_KEY_ID: \${SECRET_RESTIC_AWS_ACCESS_KEY_ID}
  AWS_SECRET_ACCESS_KEY: \${SECRET_RESTIC_AWS_SECRET_ACCESS_KEY}
---
apiVersion: volsync.backube/v1alpha1
kind: ReplicationSource
metadata:
  name: ${appName}-backup
  namespace: ${namespace}
spec:
  sourcePVC: ${pvc}
  trigger:
    schedule: "0 0 * * *"
  restic:
    copyMethod: ${method}
    pruneIntervalDays: 14
    repository: restic-config-backup-${appName}
    storageClassName: longhorn
    volumeSnapshotClassName: longhorn
    retain:
      daily: 10
      weekly: 4
      monthly: 2
      yearly: 1
`;
  fs.writeFileSync(yamlPath, code);
}

let namespace;

namespace = "home";
backupCode("apps/home/esphome/backup.yaml", "esphome", namespace, "esphome-pvc")
backupCode("apps/home/home-assistant/backup.yaml", "home-assistant", namespace, "home-assistant-pvc")
backupCode("apps/home/nodered/backup.yaml", "nodered", namespace, "node-red-config-v1")
backupCode("apps/home/zigbee2mqtt/backup.yaml", "zigbee2mqtt", namespace, "zigbee2mqtt-pvc", "Snapshot")

namespace = "databases";
backupCode("core/databases/postgres/pgdump/backup.yaml", "postgresql-dump", namespace, "postgres-cluster-dump")