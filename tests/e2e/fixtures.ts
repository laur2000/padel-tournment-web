import { test as base, expect } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

export const test = base.extend<{}>({
    page: async ({ page }, use) => {
        // Start mixed coverage (JS + CSS)
        // Only Chromium supports native V8 coverage
        const browserName = page.context().browser()?.browserType().name();
        const isChromium = browserName === 'chromium';
        
        if (isChromium) {
            await Promise.all([
                page.coverage.startJSCoverage({
                    resetOnNavigation: false
                }),
                page.coverage.startCSSCoverage({
                    resetOnNavigation: false
                })
            ]);
        }

        await use(page);

        if (isChromium) {
            const [jsCoverage, cssCoverage] = await Promise.all([
                page.coverage.stopJSCoverage(),
                page.coverage.stopCSSCoverage()
            ]);
            
            const coverageList = [...jsCoverage, ...cssCoverage];
            // Attach coverage using monocart-reporter
            await addCoverageReport(coverageList, base.info());
        }
    }
});

export { expect };
