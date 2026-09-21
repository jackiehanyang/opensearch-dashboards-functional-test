/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { createSampleDetector } from '../../../utils/helpers';
import { AD_URL } from '../../../utils/plugins/anomaly-detection-dashboards-plugin/constants';

context('Sample detectors', () => {
  before(() => {
    cy.visit(AD_URL.OVERVIEW, { timeout: 10000 });
  });
  beforeEach(() => {
    cy.deleteAllIndices();
    cy.deleteADSystemIndices();
  });
  afterEach(() => {
    cy.deleteAllIndices();
    cy.deleteADSystemIndices();
  });

  it('HTTP response sample detector - create and delete', () => {
    createSampleDetector('createHttpSampleDetectorButton');
  });

  it('eCommerce sample detector - create and delete', () => {
    createSampleDetector('createECommerceSampleDetectorButton');
  });

  // TODO: Re-enable once Host health sample creation is stable in CI.
  // https://github.com/opensearch-project/anomaly-detection-dashboards-plugin/issues/1244
  it.skip('Host health sample detector - create and delete', () => {
    createSampleDetector('createHostHealthSampleDetectorButton');
  });
});
