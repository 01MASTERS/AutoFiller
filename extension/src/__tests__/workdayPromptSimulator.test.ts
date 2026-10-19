/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fillAriaDropdown, extractCandidateValues } from '../content/formFiller/simulators/selectSimulator.js';
import { fillFormFields } from '../content/formFiller/index.js';
import { extractFormFields } from '../content/domReader/fieldDiscovery.js';
import { FieldMetadata } from '@autofiller/shared';

describe('Workday Dynamic Prompt & Portal Simulator Tests', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('fills Workday prompt button with body portal search input and Enter submission', async () => {
    // 1. Initial Workday DOM with trigger button (no popup in DOM yet)
    document.body.innerHTML = `
      <div data-automation-id="formField-country" class="wd-form-group">
        <label id="country-lbl">Country</label>
        <button type="button"
                id="country-btn"
                data-automation-id="select-country-prompt"
                aria-labelledby="country-lbl"
                aria-haspopup="listbox"
                aria-expanded="false">
          <span data-automation-id="prompt-selected-value">Select a Country</span>
        </button>
      </div>
    `;

    const btn = document.getElementById('country-btn') as HTMLButtonElement;
    const selectedSpan = btn.querySelector('[data-automation-id="prompt-selected-value"]') as HTMLElement;

    // Simulate Workday component behavior when button is clicked:
    // Workday appends a floating portal dialog to document.body containing a search box
    btn.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', 'true');

      const portal = document.createElement('div');
      portal.setAttribute('data-automation-widget', 'wd-popup');
      portal.setAttribute('role', 'dialog');
      portal.className = 'workday-popup-portal';
      portal.innerHTML = `
        <div role="listbox" data-automation-id="select-options">
          <input type="text" data-automation-id="searchBox" placeholder="Search..." />
          <div class="options-container" id="results-container"></div>
        </div>
      `;
      document.body.appendChild(portal);

      const searchInput = portal.querySelector<HTMLInputElement>('[data-automation-id="searchBox"]')!;
      const resultsContainer = portal.querySelector<HTMLElement>('#results-container')!;

      // In Workday, options only arrive when Enter is pressed on the search input
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          setTimeout(() => {
            resultsContainer.innerHTML = `
              <div role="option" data-automation-id="promptOption" data-value="IN" class="wd-opt">
                <span data-automation-id="promptOptionText">India</span>
              </div>
              <div role="option" data-automation-id="promptOption" data-value="US" class="wd-opt">
                <span data-automation-id="promptOptionText">United States</span>
              </div>
            `;

            // When an option is clicked in Workday, the selected label updates and portal is removed
            resultsContainer.querySelectorAll('[role="option"]').forEach((optEl) => {
              optEl.addEventListener('click', () => {
                const text = optEl.querySelector('span')?.textContent || '';
                selectedSpan.textContent = text;
                btn.setAttribute('aria-expanded', 'false');
                portal.remove();
              });
            });
          }, 15);
        }
      });
    });

    const success = await fillAriaDropdown(btn, 'India', document);

    expect(success).toBe(true);
    expect(selectedSpan.textContent).toBe('India');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('handles Workday prompt where options are pre-rendered in a floating menu', async () => {
    document.body.innerHTML = `
      <div data-automation-id="formField-source" class="wd-form-group">
        <label id="source-lbl">How did you hear about us?</label>
        <button type="button"
                id="source-btn"
                data-automation-id="select-source-prompt"
                aria-haspopup="listbox"
                aria-expanded="false">
          <span data-automation-id="prompt-selected-value">Select Source</span>
        </button>
      </div>
    `;

    const btn = document.getElementById('source-btn') as HTMLButtonElement;
    const selectedSpan = btn.querySelector('[data-automation-id="prompt-selected-value"]') as HTMLElement;

    btn.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', 'true');
      const menu = document.createElement('div');
      menu.setAttribute('data-automation-id', 'popupList');
      menu.setAttribute('role', 'listbox');
      menu.innerHTML = `
        <div role="option" data-automation-id="promptOption" class="opt">LinkedIn</div>
        <div role="option" data-automation-id="promptOption" class="opt">Indeed</div>
        <div role="option" data-automation-id="promptOption" class="opt">Referral</div>
      `;
      document.body.appendChild(menu);

      menu.querySelectorAll('[role="option"]').forEach((opt) => {
        opt.addEventListener('click', () => {
          selectedSpan.textContent = opt.textContent;
          btn.setAttribute('aria-expanded', 'false');
          menu.remove();
        });
      });
    });

    const success = await fillAriaDropdown(btn, 'LinkedIn', document);

    expect(success).toBe(true);
    expect(selectedSpan.textContent).toBe('LinkedIn');
  });

  it('fillFormFields orchestrates Workday text fields and prompt comboboxes end-to-end', async () => {
    document.body.innerHTML = `
      <form id="wd-app">
        <div data-automation-id="formField-legalNameSection_firstName">
          <label for="firstName">First Name</label>
          <input type="text" id="firstName" name="legalNameSection_firstName" data-autofiller-id="firstName" />
        </div>
        <div data-automation-id="formField-country">
          <label id="country-lbl">Country</label>
          <button type="button"
                  id="country-prompt"
                  data-automation-id="prompt-country"
                  data-autofiller-id="country-prompt"
                  aria-haspopup="listbox"
                  aria-expanded="false">
            <span data-automation-id="prompt-selected-value">Select Country</span>
          </button>
        </div>
      </form>
    `;

    const firstInput = document.getElementById('firstName') as HTMLInputElement;
    const countryBtn = document.getElementById('country-prompt') as HTMLButtonElement;
    const countrySpan = countryBtn.querySelector('[data-automation-id="prompt-selected-value"]') as HTMLElement;

    countryBtn.addEventListener('click', () => {
      countryBtn.setAttribute('aria-expanded', 'true');
      const portal = document.createElement('div');
      portal.setAttribute('data-automation-widget', 'wd-popup');
      portal.innerHTML = `
        <div role="listbox">
          <input type="text" data-automation-id="searchBox" />
          <div id="results"></div>
        </div>
      `;
      document.body.appendChild(portal);

      const searchInput = portal.querySelector<HTMLInputElement>('[data-automation-id="searchBox"]')!;
      const results = portal.querySelector<HTMLElement>('#results')!;

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          setTimeout(() => {
            results.innerHTML = `
              <div role="option" data-automation-id="promptOption">
                <span data-automation-id="promptOptionText">United States of America</span>
              </div>
            `;
            results.querySelector('[role="option"]')!.addEventListener('click', () => {
              countrySpan.textContent = 'United States of America';
              countryBtn.setAttribute('aria-expanded', 'false');
              portal.remove();
            });
          }, 15);
        }
      });
    });

    const fields: FieldMetadata[] = [
      { id: 'firstName', name: 'legalNameSection_firstName', label: 'First Name', controlType: 'text', type: 'text' },
      { id: 'country-prompt', label: 'Country', controlType: 'combobox', type: 'combobox', optionSource: 'dynamic', options: [] },
    ];

    const mappings = {
      firstName: 'Alex',
      'country-prompt': 'United States of America',
    };

    const result = await fillFormFields(mappings, fields, document);

    expect(result.status).toBe('success');
    expect(firstInput.value).toBe('Alex');
    expect(countrySpan.textContent).toBe('United States of America');
  });

  it('drills down hierarchical categories for "How did you hear about us?" (Job Board -> LinkedIn)', async () => {
    document.body.innerHTML = `
      <div data-automation-id="formField-source" class="wd-form-group">
        <label id="source-lbl">How did you hear about us?</label>
        <button type="button"
                id="source-prompt-btn"
                data-automation-id="sourcePrompt"
                aria-haspopup="listbox"
                aria-expanded="false">
          <span data-automation-id="prompt-selected-value">Select Source</span>
        </button>
      </div>
    `;

    const btn = document.getElementById('source-prompt-btn') as HTMLButtonElement;
    const selectedSpan = btn.querySelector('[data-automation-id="prompt-selected-value"]') as HTMLElement;

    // Simulate Workday hierarchical prompt behavior:
    btn.addEventListener('click', () => {
      btn.setAttribute('aria-expanded', 'true');
      const popup = document.createElement('div');
      popup.setAttribute('data-automation-widget', 'wd-popup');
      popup.className = 'workday-popup-portal';

      // Step 1: Initial render only contains categories (no LinkedIn yet!)
      popup.innerHTML = `
        <div role="listbox" data-automation-id="select-options">
          <input type="text" data-automation-id="searchBox" placeholder="Search..." />
          <div class="category-list" id="prompt-items">
            <div role="option" data-automation-id="promptOption-JobBoard" class="wd-category">
              <span data-automation-id="promptOptionText">Job Board</span>
            </div>
            <div role="option" data-automation-id="promptOption-Campus" class="wd-category">
              <span data-automation-id="promptOptionText">Campus Campaign</span>
            </div>
            <div role="option" data-automation-id="promptOption-Social" class="wd-category">
              <span data-automation-id="promptOptionText">Social Media</span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(popup);

      const jobBoardOpt = popup.querySelector('[data-automation-id="promptOption-JobBoard"]')!;
      // When "Job Board" category is clicked, Workday replaces options with leaf sources
      jobBoardOpt.addEventListener('click', () => {
        const items = popup.querySelector('#prompt-items')!;
        items.innerHTML = `
          <div role="option" data-automation-id="promptOption-LinkedIn" class="wd-leaf">
            <span data-automation-id="promptOptionText">LinkedIn</span>
          </div>
          <div role="option" data-automation-id="promptOption-Indeed" class="wd-leaf">
            <span data-automation-id="promptOptionText">Indeed</span>
          </div>
          <div role="option" data-automation-id="promptOption-Glassdoor" class="wd-leaf">
            <span data-automation-id="promptOptionText">Glassdoor</span>
          </div>
        `;

        const linkedInOpt = items.querySelector('[data-automation-id="promptOption-LinkedIn"]')!;
        linkedInOpt.addEventListener('click', () => {
          selectedSpan.textContent = 'LinkedIn';
          btn.setAttribute('aria-expanded', 'false');
          popup.remove();
        });
      });
    });

    const success = await fillAriaDropdown(btn, 'LinkedIn', document);

    expect(success).toBe(true);
    expect(selectedSpan.textContent).toBe('LinkedIn');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('determines and selects correct Country Phone Code from dynamic backend options', async () => {
    document.body.innerHTML = `
      <form id="wd-phone-form">
        <div data-automation-id="formField-countryPhoneCode" class="form-group">
          <label id="cpc-lbl">Country Phone Code</label>
          <button type="button"
                  id="country-phone-code-btn"
                  data-automation-id="countryPhoneCode-prompt"
                  aria-haspopup="listbox"
                  aria-expanded="false">
            <span data-automation-id="prompt-selected-value">Select Country Code</span>
          </button>
        </div>
        <div data-automation-id="formField-phoneNumber" class="form-group">
          <label for="phoneNumber">Phone Number</label>
          <input type="tel" id="phoneNumber" name="phoneNumber" data-autofiller-id="phoneNumber" />
        </div>
      </form>
    `;

    const codeBtn = document.getElementById('country-phone-code-btn') as HTMLButtonElement;
    const codeSpan = codeBtn.querySelector('[data-automation-id="prompt-selected-value"]') as HTMLElement;
    const phoneInput = document.getElementById('phoneNumber') as HTMLInputElement;

    // Simulate Workday dynamic Country Phone Code prompt:
    codeBtn.addEventListener('click', () => {
      codeBtn.setAttribute('aria-expanded', 'true');
      const popup = document.createElement('div');
      popup.setAttribute('data-automation-widget', 'wd-popup');
      popup.innerHTML = `
        <div role="listbox" data-automation-id="select-options">
          <input type="text" data-automation-id="searchBox" placeholder="Search country code..." />
          <div id="country-results">
            <div role="option" data-automation-id="promptOption" class="wd-country-opt">
              <span data-automation-id="promptOptionText">United States of America (+1)</span>
            </div>
            <div role="option" data-automation-id="promptOption" class="wd-country-opt">
              <span data-automation-id="promptOptionText">India (+91)</span>
            </div>
            <div role="option" data-automation-id="promptOption" class="wd-country-opt">
              <span data-automation-id="promptOptionText">Indonesia (+62)</span>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(popup);

      popup.querySelectorAll('[role="option"]').forEach((opt) => {
        opt.addEventListener('click', () => {
          codeSpan.textContent = opt.querySelector('span')?.textContent || opt.textContent || '';
          codeBtn.setAttribute('aria-expanded', 'false');
          popup.remove();
        });
      });
    });

    const fields: FieldMetadata[] = [
      { id: 'country-phone-code-btn', label: 'Country Phone Code', controlType: 'combobox', optionSource: 'dynamic', options: [] },
      { id: 'phoneNumber', label: 'Phone Number', controlType: 'text' },
    ];

    // Profile has phone "+91 9876543210"
    const mappings = {
      'country-phone-code-btn': '+91',
      phoneNumber: '+91 9876543210',
    };

    const result = await fillFormFields(mappings, fields, document);

    expect(result.status).toBe('success');
    expect(codeSpan.textContent).toBe('India (+91)');
    // Phone input should have country code stripped
    expect(phoneInput.value).toBe('9876543210');
  });

  it('correctly splits compound preference strings and strips negations in extractCandidateValues', () => {
    expect(extractCandidateValues('LinkedIn,Indeed,Career page OR anything except referral')).toEqual([
      'LinkedIn',
      'Indeed',
      'Career page',
    ]);
    expect(extractCandidateValues('LinkedIn / Indeed / Company Website')).toEqual([
      'LinkedIn',
      'Indeed',
      'Company Website',
    ]);
    expect(extractCandidateValues('India (+91)')).toEqual(['India (+91)']);
    expect(extractCandidateValues('+91')).toEqual(['+91']);
    expect(extractCandidateValues('LinkedIn')).toEqual(['LinkedIn']);
  });

  it('scans Workday prompt without generating phantom duplicate fields for wrappers, pills, or options', () => {
    document.body.innerHTML = `
      <div data-automation-id="workdayApplicationRoot">
        <div data-automation-id="formField-source">
          <label>How did you hear about us? *</label>
          <div data-automation-id="multiselectInputContainer">
            <ul data-automation-id="selectedItemList">
              <li data-automation-id="pill-sample123">
                <span data-automation-id="promptOption">Previous Selection</span>
                <button type="button" aria-label="Indeed, press delete to clear value.">x</button>
              </li>
            </ul>
            <input data-automation-id="source--source" role="combobox" aria-haspopup="true" aria-expanded="false" />
            <span data-automation-id="promptSelectionLabel">Select source</span>
            <button type="button" data-automation-id="promptSearchButton" aria-label="Search prompt">Search</button>
          </div>
        </div>
      </div>
    `;

    const fields = extractFormFields(document);
    // There must be exactly 1 field for this question: the interactive input combobox
    expect(fields.length).toBe(1);
    expect(fields[0].id).toContain('source--source');
    expect(fields[0].controlType).toBe('combobox');
    expect(fields[0].label).toContain('How did you hear about us?');
  });

  it('routes input[role="combobox"] through fillAriaDropdown and selects preferred candidate option', async () => {
    document.body.innerHTML = `
      <div data-automation-id="formField-source">
        <label id="lbl-source">How did you hear about us?</label>
        <div data-automation-id="multiselectInputContainer">
          <ul data-automation-id="selectedItemList" id="pill-list"></ul>
          <input data-automation-id="source--source"
                 id="source-input"
                 role="combobox"
                 aria-haspopup="true"
                 aria-expanded="false"
                 data-autofiller-id="source--source" />
          <button type="button" data-automation-id="promptSearchButton" id="search-btn">Search</button>
        </div>
      </div>
    `;

    const input = document.getElementById('source-input') as HTMLInputElement;
    const pillList = document.getElementById('pill-list') as HTMLUListElement;

    // Simulate Workday behavior: typing or clicking search button opens popup
    const openPopup = () => {
      if (document.querySelector('[data-automation-widget="wd-popup"]')) return;
      input.setAttribute('aria-expanded', 'true');
      const popup = document.createElement('div');
      popup.setAttribute('data-automation-widget', 'wd-popup');
      popup.className = 'workday-popup-portal';
      popup.innerHTML = `
        <div role="listbox" data-automation-id="popupList">
          <div role="option" data-automation-id="promptOption" id="opt-linkedin">
            <span data-automation-id="promptOptionText">LinkedIn</span>
          </div>
          <div role="option" data-automation-id="promptOption" id="opt-indeed">
            <span data-automation-id="promptOptionText">Indeed</span>
          </div>
        </div>
      `;
      document.body.appendChild(popup);

      popup.querySelectorAll('[role="option"]').forEach((opt) => {
        opt.addEventListener('click', () => {
          const text = opt.querySelector('span')?.textContent || '';
          pillList.innerHTML = `<li data-automation-id="pill-selected"><span>${text}</span></li>`;
          input.value = '';
          input.setAttribute('aria-expanded', 'false');
          popup.remove();
        });
      });
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') openPopup();
    });
    document.getElementById('search-btn')?.addEventListener('click', openPopup);

    const fields: FieldMetadata[] = [
      { id: 'source--source', label: 'How did you hear about us?', controlType: 'combobox', optionSource: 'dynamic', options: [] },
    ];

    const result = await fillFormFields(
      { 'source--source': 'LinkedIn,Indeed,Career page OR anything except referral' },
      fields,
      document,
    );

    expect(result.status).toBe('success');
    expect(pillList.textContent).toBe('LinkedIn');
  });
});

