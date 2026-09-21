/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { CURRENT_TENANT } from '../../../../utils/commands';

const isWorkspaceEnabled = Cypress.env('WORKSPACE_ENABLED');
const workspaceName = `test_nav_menu`;
const workspaceDescription =
  'This is a test workspace for left navigation menu.';
let workspaceId;
let previousNewHomePage;
let restoreNewHomePage = false;

before(() => {
  cy.request({
    url: '/api/opensearch-dashboards/settings',
    qs: Cypress.env('SECURITY_ENABLED')
      ? { security_tenant: CURRENT_TENANT.defaultTenant }
      : {},
  }).then(({ body }) => {
    const setting = body.settings['home:useNewHomePage'];
    if (setting?.userValue !== true) {
      previousNewHomePage = setting?.userValue ?? null;
      restoreNewHomePage = true;
      cy.setAdvancedSetting({ 'home:useNewHomePage': true });
    }
  });
});

after(() => {
  if (restoreNewHomePage) {
    cy.setAdvancedSetting({ 'home:useNewHomePage': previousNewHomePage });
  }
});

const visitHome = () => {
  cy.visit('app/home', {
    onBeforeLoad(win) {
      // Keep the first-visit experience notice from covering the navigation.
      win.localStorage.setItem('home:enhancedDiscover:dismissed', 'true');
    },
  });
  cy.location('pathname').should('include', '/app/home');
  cy.get('.contentManagement-page').should('be.visible');
};

const getVisibleNav = () =>
  cy.getElementByTestId('collapsibleNav').filter(':visible');

const createWorkspace = (feature) => {
  return cy
    .createWorkspace({
      name: `${workspaceName}_${feature}`,
      description: workspaceDescription,
      features: [`use-case-${feature}`],
    })
    .then((value) => {
      workspaceId = value;
      return value;
    });
};

/**
 * Helper to ensure the left navigation panel is expanded.
 * Pins the navigation open using ChromeService's persisted setting.
 * Reloading applies the setting to both classic and observability navigation.
 */
const ensureNavExpanded = (feature = 'all') => {
  if (isWorkspaceEnabled) {
    // Wait for the target workspace before changing its navigation state.
    cy.location('pathname').should('include', `/w/${workspaceId}/`);
    cy.getElementByTestId('breadcrumbs').should(
      'contain',
      `${workspaceName}_${feature}`
    );
  }

  // Force the persisted nav state to expanded
  cy.window().then((win) => {
    const key = 'core.chrome.isLocked';
    if (win.localStorage.getItem(key) !== 'true') {
      win.localStorage.setItem(key, 'true');
      cy.reload();
    }
  });

  getVisibleNav().should('exist');

  // Verify the nav is actually expanded by checking for expanded content
  getVisibleNav()
    .find(
      'input[type="search"], .euiAccordion__button, [data-test-subj="obsExpandedNav"]',
      { timeout: 60000 }
    )
    .first()
    .should('be.visible');
};
if (isWorkspaceEnabled) {
  const validateWorkspaceNavMenu = (feature, callbackFn) => {
    createWorkspace(feature).then(() => {
      cy.visit(`w/${workspaceId}/app/discover`);
      cy.get('.content', { timeout: 60000 }).should('exist');

      ensureNavExpanded(feature);

      getVisibleNav().within(() => {
        cy.getElementByTestId('workspace-selector-current-name')
          .should('contain', `${workspaceName}_${feature}`)
          .should('be.visible');
        callbackFn();
      });

      // Workspace controls are now grouped in the navigation footer.
      getVisibleNav()
        .find('[data-test-subj="manageWorkspaceMenuButton"]')
        .click();
      cy.getElementByTestId('manageWorkspaceMenuPopover')
        .should('be.visible')
        .contains('Workspace details')
        .should('be.visible');
      getVisibleNav()
        .find('[data-test-subj="manageWorkspaceMenuButton"]')
        .click();
    });
  };

  const validateWorkspaceNavMenuSearch = (input, callbackFn) => {
    createWorkspace('all').then(() => {
      cy.visit(`w/${workspaceId}/app/all_overview`);

      ensureNavExpanded();

      cy.getElementByTestId('global-search-input')
        .should('be.visible')
        .should('not.be.disabled')
        .click({ force: true });

      // Wait for search input to stabilize after click, then type
      cy.wait(500);
      cy.getElementByTestId('global-search-input').type(input, {
        force: true,
        delay: 50,
      });

      callbackFn();
    });
  };

  describe('Left navigation menu in workspace', () => {
    before(() => {
      cy.deleteAllWorkspaces();
    });

    afterEach(() => {
      if (workspaceId) {
        cy.deleteWorkspaceById(workspaceId);
      }
    });

    it('features are visible inside left navigation for analytics use case', () => {
      validateWorkspaceNavMenu('all', () => {
        cy.contains(/Visualize and report/).should('exist');
        cy.contains(/Search/).should('exist');
        cy.contains(/Detect/).should('exist');
      });
    });

    it('features are visible inside left navigation for essentials use case', () => {
      validateWorkspaceNavMenu('essentials', () => {});
    });

    it('features are visible inside left navigation for search use case', () => {
      validateWorkspaceNavMenu('search', () => {
        cy.contains(/Visualize and report/).should('exist');
      });
    });

    it('features are visible inside left navigation for security analytics use case', () => {
      validateWorkspaceNavMenu('security-analytics', () => {
        cy.contains(/Visualize and report/).should('exist');
        cy.contains(/Detect/).should('exist');
      });
    });

    it('features are visible inside left navigation for observability use case', () => {
      validateWorkspaceNavMenu('observability', () => {
        cy.contains(/Visualize and report/).should('exist');
        cy.contains(/Detect/).should('exist');
      });
    });

    it('verify workspace identification in navigation', () => {
      createWorkspace('all').then(() => {
        cy.visit(`w/${workspaceId}/app/all_overview`);

        ensureNavExpanded();

        cy.get('.left-navigation-wrapper').within(() => {
          cy.contains(`${workspaceName}_all`).should('be.visible');
        });
      });
    });

    it('navigation search should only search use case related features when inside a workspace', () => {
      validateWorkspaceNavMenuSearch('visu', () => {
        cy.getElementByTestId('search-result-panel').within(() => {
          cy.contains(/Visualizations/).should('exist');
        });
      });
    });

    it('navigation search should show be able to search dev tools and open it as modal', () => {
      validateWorkspaceNavMenuSearch('dev', () => {
        cy.getElementByTestId('search-result-panel').within(() => {
          cy.contains(/Dev Tools/).should('be.visible');
          cy.contains(/Console/)
            .should('be.visible')
            .click({ force: true });

          cy.document().then((doc) => {
            cy.wrap(doc.body).click('center');
            cy.wrap(doc.body)
              .contains(/Dev Tools/)
              .should('be.visible');
          });
        });
      });
    });
  });
}
describe('Left navigation menu', () => {
  before(() => {
    if (isWorkspaceEnabled) {
      cy.deleteAllWorkspaces();
    }
  });

  beforeEach(() => {
    // Reset persisted nav collapse state so tests start with nav expanded
    cy.window().then((win) => {
      win.localStorage.removeItem('core.chrome.isLocked');
    });
  });

  afterEach(() => {
    if (isWorkspaceEnabled && workspaceId) {
      cy.deleteWorkspaceById(workspaceId);
    }
  });

  it('collapsible menu sections', () => {
    const validateMenuSection = () => {
      ensureNavExpanded();

      // Wait for nav content to fully render
      cy.get('.left-navigation-wrapper')
        .contains(/Visualize and report/i)
        .should('exist');

      // Scroll into view separately to avoid detached DOM issues
      cy.get('.left-navigation-wrapper')
        .contains(/Visualize and report/i)
        .scrollIntoView({ block: 'center', inline: 'center' });

      cy.get('.left-navigation-wrapper')
        .contains(/Visualize and report/i)
        .should('be.visible');

      cy.get('.left-navigation-wrapper')
        .contains('Visualizations')
        .should('be.visible');

      // Click the accordion toggle to collapse
      cy.get('.left-navigation-wrapper .euiAccordion__button')
        .contains(/Visualize and report/i)
        .click({ force: true });
      cy.get('.left-navigation-wrapper')
        .contains('Visualizations')
        .should('not.exist');

      // Click again to expand
      cy.get('.left-navigation-wrapper .euiAccordion__button')
        .contains('Visualize and report')
        .click();
      cy.get('.left-navigation-wrapper')
        .contains('Visualizations')
        .should('be.visible');
    };
    if (isWorkspaceEnabled) {
      createWorkspace('all').then(() => {
        cy.visit(`w/${workspaceId}/app/all_overview`);
        validateMenuSection();
      });
    } else {
      visitHome();
      validateMenuSection();
    }
  });

  it('navigation should remember state of expand in browser', () => {
    const validateMenuState = () => {
      ensureNavExpanded();

      cy.get('.left-navigation-wrapper').within(() => {
        isWorkspaceEnabled &&
          cy.contains(`${workspaceName}_all`).should('be.visible');
        cy.get('input[type="search"]').should('be.visible');
        cy.get('.bottom-container-expanded').should('be.visible');
        cy.getElementByTestId('collapsibleNavShrinkButton')
          .should('be.visible')
          .click({ force: true });
      });

      cy.reload();
      cy.get('.left-navigation-wrapper').find('.euiPanel').should('not.exist');
      cy.get('.left-navigation-wrapper').within(() => {
        isWorkspaceEnabled &&
          cy.contains(`${workspaceName}_all`).should('not.exist');
        cy.get('input[type="search"]').should('not.exist');
        cy.get('.bottom-container-expanded').should('not.exist');
      });
    };

    if (isWorkspaceEnabled) {
      createWorkspace('all').then(() => {
        cy.visit(`w/${workspaceId}/app/all_overview`);
        validateMenuState();
      });
    } else {
      visitHome();
      validateMenuState();
    }
  });

  it('validate navigation history functionality', () => {
    const validateRecentHistory = () => {
      ensureNavExpanded();

      // Ensure "Visualize and report" is expanded so visualize navigation link is present.
      cy.get('.left-navigation-wrapper').then(($nav) => {
        const visualizeLinkSelector = 'a[href*="/app/visualize"]';
        if ($nav.find(`${visualizeLinkSelector}:visible`).length === 0) {
          cy.get('.left-navigation-wrapper .euiAccordion__button')
            .contains(/Visualize and report/i)
            .click({ force: true });
        }
      });

      // Prefer a deterministic route link across workspace/security combinations.
      cy.get('body').then(($body) => {
        const visualizeLinkSelector =
          '.left-navigation-wrapper a[href*="/app/visualize"]';
        if ($body.find(visualizeLinkSelector).length > 0) {
          cy.get(visualizeLinkSelector).first().should('be.visible').click({
            force: true,
          });
        } else {
          cy.get('.left-navigation-wrapper')
            .contains(/Visualizations/)
            .should('be.visible')
            .click({ force: true });
        }
      });

      // Fallback direct route when sidebar click is swallowed by UI state.
      cy.location('pathname', { timeout: 15000 }).then((pathname) => {
        if (!pathname.includes('/app/visualize')) {
          cy.visit('app/visualize#/');
        }
      });

      // Ensure navigation to Visualize page is completed before asserting table
      cy.location('pathname', { timeout: 60000 }).should(
        'include',
        '/app/visualize'
      );
      cy.get('.application', { timeout: 60000 }).should('exist');

      cy.getElementByTestId('itemsInMemTable')
        .find('.euiLink')
        .first()
        .invoke('text')
        .then((visualizationName) => {
          cy.getElementByTestId('itemsInMemTable')
            .contains(visualizationName)
            .click({ force: true });

          cy.get('.visualize', { timeout: 60000 }).should('exist');
          cy.get('.headerRecentItemsButton--loadingIndicator').should(
            'not.exist'
          );

          cy.get('.headerRecentItemsButton')
            .should('be.visible')
            .click({ force: true });

          cy.contains(/Recent assets/).should('be.visible');
          cy.contains(visualizationName).should('be.visible');

          cy.get('.left-navigation-wrapper').within(() => {
            cy.contains(/Dashboards/)
              .scrollIntoView()
              .click({ force: true });
          });

          cy.get('.application', { timeout: 60000 }).should('exist');
          cy.get('.headerRecentItemsButton--loadingIndicator').should(
            'not.exist'
          );

          cy.get('.headerRecentItemsButton')
            .should('be.visible')
            .click({ force: true });

          cy.contains(/Recent assets/).should('be.visible');
          cy.contains(visualizationName)
            .should('be.visible')
            .click({ force: true });

          cy.getElementByTestId('headerAppActionMenu').within(() => {
            cy.url().should('contain', 'edit').should('contain', 'visualize');
            cy.contains(visualizationName).should('be.visible');
          });
        });
    };

    if (isWorkspaceEnabled) {
      createWorkspace('all').then(() => {
        cy.loadSampleDataForWorkspace('ecommerce', workspaceId).then(() => {
          cy.visit(`w/${workspaceId}/app/all_overview`);
          validateRecentHistory();
        });
      });
    } else {
      cy.loadSampleData('ecommerce').then(() => {
        visitHome();
        validateRecentHistory();
      });
    }
  });
});
