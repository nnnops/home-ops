#!/usr/bin/env zx
$.verbose = false;
const helmReleases = JSON.parse(await $`kubectl get -A hr -o json`);

for(const item of helmReleases['items']) {
    const name = item.metadata.name;
    const namespace = item.metadata.namespace;
    const message = item.status.conditions[0].message;
    if (message.endsWith('retries exhausted')) {
        console.log(`Suspending and resuming ${name} in ${namespace}`);
        $`flux -n ${namespace} suspend hr ${name} && flux -n ${namespace} resume hr ${name}`;
    }
    if (item.spec.suspend) {
        console.log(`Resuming ${name} in ${namespace}`);
        $`flux -n ${namespace} resume hr ${name}`;
    }
}