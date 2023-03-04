#!/usr/bin/env zx

await $`git push`;
await $`flux reconcile source git flux-system`;
await $`flux reconcile kustomization flux-system`;

await Promise.all([
    $`flux reconcile kustomization crds`,
    $`flux reconcile kustomization config`,
    $`flux reconcile kustomization charts`,
])
await $`flux reconcile kustomization core`;
await $`flux reconcile kustomization apps`;