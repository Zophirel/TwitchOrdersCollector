const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function sanitizeFileName(value) {
  return String(value || 'localhost').replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'localhost';
}

function fileExists(filePath) {
  return Boolean(filePath) && fs.existsSync(filePath);
}

function buildCertificatePaths(baseDir, host) {
  const safeHost = sanitizeFileName(host);
  return {
    certPath: path.join(baseDir, `${safeHost}.pem`),
    keyPath: path.join(baseDir, `${safeHost}-key.pem`)
  };
}

function runMkcert(binaryPath, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `mkcert exited with code ${code}`));
    });
  });
}

class MkcertService {
  constructor({ outputDir }) {
    this.outputDir = outputDir;
  }

  computePaths(settings) {
    const redirectHost = String(settings.oauthRedirectHost || 'localhost').trim() || 'localhost';
    const generatedPaths = buildCertificatePaths(this.outputDir, redirectHost);
    return {
      certPath: String(settings.mkcertCertPath || '').trim() || generatedPaths.certPath,
      keyPath: String(settings.mkcertKeyPath || '').trim() || generatedPaths.keyPath
    };
  }

  async ensureCertificate(settings, options = {}) {
    const host = String(settings.oauthRedirectHost || 'localhost').trim() || 'localhost';
    const binaryPath = String(settings.mkcertBinaryPath || 'mkcert').trim() || 'mkcert';
    const { certPath, keyPath } = this.computePaths(settings);
    const force = options.force === true;

    if (!force && fileExists(certPath) && fileExists(keyPath)) {
      return {
        changed: false,
        certPath,
        keyPath,
        host,
        message: 'Existing mkcert certificate reused.'
      };
    }

    fs.mkdirSync(path.dirname(certPath), { recursive: true });
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });

    await runMkcert(binaryPath, ['-install'], process.cwd());

    const subjectAltNames = [...new Set([host, 'localhost', '127.0.0.1', '::1'])];
    await runMkcert(
      binaryPath,
      ['-cert-file', certPath, '-key-file', keyPath, ...subjectAltNames],
      process.cwd()
    );

    if (!fileExists(certPath) || !fileExists(keyPath)) {
      throw new Error('mkcert finished without producing the expected certificate files.');
    }

    return {
      changed: true,
      certPath,
      keyPath,
      host,
      message: 'mkcert certificate created or updated.'
    };
  }
}

module.exports = {
  MkcertService
};
