/**
 * YABBAI - Test Runner CLI
 * Usage: tsx test/run-tests.ts
 */

import { runAllVerificationTests } from './test-suite';

async function main() {
  console.log('====================================================');
  console.log('⚡ YABBAI - Production Verification Test Suite');
  console.log('====================================================\n');

  const report = await runAllVerificationTests();

  for (const r of report.results) {
    const symbol = r.passed ? '✅' : '❌';
    console.log(`${symbol} [${r.durationMs}ms] ${r.name}`);
    if (r.error) {
      console.error(`   Error: ${r.error}`);
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`Summary: ${report.passed}/${report.total} tests passed in ${report.durationMs}ms`);
  console.log('----------------------------------------------------');

  if (report.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
