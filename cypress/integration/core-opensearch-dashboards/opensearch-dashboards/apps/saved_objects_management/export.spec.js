/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { BASE_PATH } from '../../../../../utils/constants';

const SAVED_OBJECTS_PATH = `${BASE_PATH}/app/management/opensearch-dashboards/objects`;
const EXPORT_API = '/api/saved_objects/_export';
const FIND_OBJECTS_API =
  '**/api/opensearch-dashboards/management/saved_objects/_find';
const FIXTURE_PATH =
  'dashboard/opensearch_dashboards/saved_objects_management/test_saved_objects.ndjson';

const cleanupTestObjects = () => {
  cy.deleteSavedObject('index-pattern', 'test-index-pattern-id');
  cy.deleteSavedObject('dashboard', 'test-dashboard-id');
  cy.deleteSavedObject('visualization', 'test-visualization-id');
};

const visitSavedObjects = () => {
  cy.intercept({ method: 'GET', pathname: FIND_OBJECTS_API }).as(
    'findSavedObjects'
  );
  cy.visit(SAVED_OBJECTS_PATH);
  cy.wait('@findSavedObjects').its('response.statusCode').should('eq', 200);
  cy.getElementByTestId('savedObjectSearchBar').should('be.enabled');
};

const searchSavedObjects = (search) => {
  cy.intercept({
    method: 'GET',
    pathname: FIND_OBJECTS_API,
    query: { search: `${search}*` },
  }).as('searchSavedObjects');
  cy.getElementByTestId('savedObjectSearchBar').type(search).trigger('search');
  cy.wait('@searchSavedObjects').its('response.statusCode').should('eq', 200);
};

describe('Saved Objects Export', () => {
  beforeEach(() => {
    cleanupTestObjects();
    cy.importSavedObjects(FIXTURE_PATH);
  });

  describe('API', () => {
    it('should export saved objects by type', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.config().baseUrl}${EXPORT_API}`,
        headers: { 'osd-xsrf': true },
        body: {
          type: ['dashboard', 'visualization'],
          includeReferencesDeep: false,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers['content-type']).to.include(
          'application/ndjson'
        );
        const lines = response.body.split('\n').filter((line) => line.trim());
        expect(lines.length).to.be.at.least(2);
      });
    });

    it('should export specific saved objects by ID', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.config().baseUrl}${EXPORT_API}`,
        headers: { 'osd-xsrf': true },
        body: {
          objects: [
            { type: 'dashboard', id: 'test-dashboard-id' },
            { type: 'visualization', id: 'test-visualization-id' },
          ],
          includeReferencesDeep: true,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        const lines = response.body.split('\n').filter((line) => line.trim());
        expect(lines.length).to.be.at.least(2);
      });
    });

    it('should export with includeReferencesDeep option', () => {
      cy.request({
        method: 'POST',
        url: `${Cypress.config().baseUrl}${EXPORT_API}`,
        headers: { 'osd-xsrf': true },
        body: {
          type: 'dashboard',
          includeReferencesDeep: true,
          excludeExportDetails: false,
        },
      }).then((response) => {
        expect(response.status).to.eq(200);
        const lines = response.body.split('\n').filter((line) => line.trim());
        const lastLine = JSON.parse(lines[lines.length - 1]);
        expect(lastLine).to.have.property('exportedCount');
      });
    });

    it('should use exportSavedObjects command', () => {
      cy.exportSavedObjects({
        types: ['dashboard', 'visualization'],
        includeReferencesDeep: true,
      }).then((response) => {
        expect(response.status).to.eq(200);
        const lines = response.body.split('\n').filter((line) => line.trim());
        expect(lines.length).to.be.at.least(2);
      });
    });
  });

  // Each test must mount a fresh table after the API fixture setup.
  describe('UI', { testIsolation: true }, () => {
    it('should export all saved objects via UI', () => {
      visitSavedObjects();
      cy.getElementByTestId('savedObjectsTable').should('exist');
      cy.getElementByTestId('exportAllObjects').click();

      cy.get('.euiModal').should('exist');
      cy.get('.euiModal').within(() => {
        cy.contains('button', 'Export all').click();
      });

      cy.get('.euiToast', { timeout: 5000 }).should('exist');
    });

    it('should export selected saved objects via UI', () => {
      visitSavedObjects();
      cy.getElementByTestId('savedObjectsTable').should('exist');

      searchSavedObjects('Test');

      cy.get('.euiTableRow .euiCheckbox__input').first().check({ force: true });
      cy.get('button').contains('Export').should('not.be.disabled');
    });

    it('should display saved objects in table', () => {
      visitSavedObjects();
      searchSavedObjects('Test Dashboard');

      cy.getElementByTestId('savedObjectsTableRowTitle').should(
        'contain',
        'Test Dashboard'
      );
    });

    it('should filter saved objects by type', () => {
      visitSavedObjects();
      cy.getElementByTestId('savedObjectsTable').should('exist');

      cy.get('.euiFilterButton').contains('Type').click();
      cy.contains('button[role="option"]', /^dashboard \(/).click();
      cy.get('body').click(0, 0);

      cy.getElementByTestId('savedObjectsTableRowTitle').should(
        'contain',
        'Test Dashboard'
      );
    });
  });
});
