const SOPMountPath = '/sop-quality-management/react';

/**
 * Keep one build usable both through the GCP vanity path and directly from
 * the Azure App Service root.
 */
export function getPublicBasePath(pathname = window.location.pathname): string {
  return pathname === SOPMountPath || pathname.startsWith(`${SOPMountPath}/`)
    ? SOPMountPath
    : '/';
}
