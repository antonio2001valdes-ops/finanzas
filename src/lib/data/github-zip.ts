import JSZip from 'jszip';

export async function generateGitHubZip(): Promise<Blob> {
  const zip = new JSZip();

  // Create a basic project structure placeholder
  zip.file('README.md', '# KHORVEN Finanzas Personales v3.2.0\n\nPersonal finance app with Cyberpunk/Neon aesthetic.\n\nLanguage: Spanish (Chile)\nCurrency: CLP\n');

  const src = zip.folder('src')!;
  src.file('lib/db-client.ts', '// Dexie database client for khorven-finance\n');
  src.file('lib/finance-utils.ts', '// Finance utility functions\n');

  const lib = src.folder('lib')!;
  const data = lib.folder('data')!;
  data.file('index.ts', '// Data services barrel export\n');

  zip.file('package.json', JSON.stringify({
    name: 'khorven-finance',
    version: '3.2.0',
    description: 'KHORVEN Finanzas Personales - Personal Finance App',
  }, null, 2));

  zip.file('.gitignore', 'node_modules/\n.next/\ndist/\n*.db\n');

  return zip.generateAsync({ type: 'blob' });
}
