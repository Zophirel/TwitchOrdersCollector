const path = require('path');
const { MkcertService } = require('../core/services/mkcertService');

function parseArguments(argv) {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      values[key] = true;
      continue;
    }

    values[key] = next;
    index += 1;
  }

  return values;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  const host = String(args.host || 'localhost');
  const outputDir = path.resolve(args.outputDir || path.join(process.cwd(), 'data', 'certs'));
  const certPath = args.certPath ? path.resolve(args.certPath) : '';
  const keyPath = args.keyPath ? path.resolve(args.keyPath) : '';
  const mkcertBinaryPath = String(args.binary || 'mkcert');
  const force = args.force === true;

  const service = new MkcertService({ outputDir });
  const result = await service.ensureCertificate(
    {
      oauthRedirectHost: host,
      mkcertBinaryPath,
      mkcertCertPath: certPath,
      mkcertKeyPath: keyPath
    },
    { force }
  );

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
