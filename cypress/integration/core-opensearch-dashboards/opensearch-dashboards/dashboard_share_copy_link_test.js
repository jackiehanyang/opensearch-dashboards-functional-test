/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */
import { STACK_MANAGEMENT_PATH } from '../../../utils/dashboards/constants';
import { CURRENT_TENANT } from '../../../utils/commands';

if (Cypress.env('SECURITY_ENABLED')) {
  describe('Copy Link functionality working', () => {
    it('copies a share link that opens Discover', () => {
      CURRENT_TENANT.newTenant = 'global';

      cy.visit(STACK_MANAGEMENT_PATH);
      cy.waitForLoader();
      const isChromium = Cypress.isBrowser({ family: 'chromium' });
      if (isChromium) {
        // Headless Chromium requires explicit permission to read the real clipboard.
        cy.then(() =>
          Cypress.automation('remote:debugger:protocol', {
            command: 'Browser.grantPermissions',
            params: {
              permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
              origin: new URL(Cypress.config('baseUrl')).origin,
            },
          })
        );
        cy.then(() =>
          Cypress.automation('remote:debugger:protocol', {
            command: 'Emulation.setFocusEmulationEnabled',
            params: { enabled: true },
          })
        );
        cy.window().then((win) => {
          win.focus();
          return win.navigator.clipboard.writeText('');
        });
      }
      cy.getElementByTestId('toggleNavButton').click();
      cy.get('span[title="Discover"]').click();
      cy.getElementByTestId('shareTopNavButton').click();
      if (isChromium) {
        cy.getElementByTestId('copyShareUrlButton').realClick();
      } else {
        cy.getElementByTestId('copyShareUrlButton').click();
      }

      cy.window()
        .then((win) => win.navigator.clipboard.readText())
        .then((clipboardData) => {
          expect(new URL(clipboardData).origin).to.equal(
            new URL(Cypress.config('baseUrl')).origin
          );
          cy.visit(clipboardData);
          cy.waitForLoader();
          cy.location('pathname').should('include', 'discover');
        });
    });
  });
}
