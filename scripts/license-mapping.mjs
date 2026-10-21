export const NO_LICENSE_FILE = 'No license file';
export const UNRECOGNISED_LICENSE = 'License file present but not recognised';

export function asApiLicense(value) {
  if (!value) return null;
  if (typeof value === 'object') return value.spdx_id || value.name || null;
  return String(value).trim() || null;
}

export function licenseDisplay(value) {
  const apiLicense = asApiLicense(value);
  if (!apiLicense) return NO_LICENSE_FILE;
  if (apiLicense.toUpperCase() === 'NOASSERTION') return UNRECOGNISED_LICENSE;
  return apiLicense;
}
