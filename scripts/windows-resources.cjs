const fs = require('node:fs/promises');
const path = require('node:path');
const resedit = require('resedit');

// Embed branding without pretending that an unsigned binary has a trusted signature.
module.exports = async function windowsResources(context) {
  if (context.electronPlatformName !== 'win32') return;
  const info = context.packager.appInfo;
  const file = path.join(context.appOutDir, info.productFilename + '.exe');
  const icon = resedit.Data.IconFile.from(await fs.readFile(path.join(context.packager.projectDir, 'build/icon.ico')));
  const executable = resedit.NtExecutable.from(await fs.readFile(file));
  const resources = resedit.NtExecutableResource.from(executable);
  resources.entries = resources.entries.filter(entry => entry.type !== 3 && entry.type !== 14);
  resedit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, 101, 1033, icon.icons.map(item => item.data));
  const version = resedit.Resource.VersionInfo.fromEntries(resources.entries)[0] || resedit.Resource.VersionInfo.createEmpty();
  const numbers = info.version.split('.').map(Number);
  version.setFileVersion(numbers[0], numbers[1], numbers[2], 0, 1033);
  version.setProductVersion(numbers[0], numbers[1], numbers[2], 0, 1033);
  version.setStringValues({lang:1033,codepage:1200}, {
    ProductName: info.productName, FileDescription: info.productName,
    CompanyName: 'SEFI Team', OriginalFilename: info.productFilename + '.exe',
    InternalName: 'sefi-launcher', LegalCopyright: 'SEFI Team',
  });
  version.outputToResourceEntries(resources.entries);
  resources.outputResource(executable);
  await fs.writeFile(file, Buffer.from(executable.generate()));
};
