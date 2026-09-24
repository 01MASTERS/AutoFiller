import { describe, it, expect, vi } from 'vitest';
import { extractFormFields } from '../content/domReader.js';
import { fillFormFields } from '../content/formFiller.js';

describe('Google Forms Tick Options (Checkboxes & Radios)', () => {
  it('detects and fills Google Forms multi-select checkboxes', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div class="geS5n">
          <div class="M7eMe" role="heading" aria-level="3">Preferred Languages</div>
          <div role="group" aria-label="Preferred Languages">
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div class="uHMk8b">
                  <div role="checkbox" class="uHMk8b" aria-checked="false" aria-label="JavaScript" tabindex="0">
                    <div class="uHMk8b"></div>
                  </div>
                </div>
                <div class="aDTYNe">
                  <span class="M7eMe">JavaScript</span>
                </div>
              </label>
            </div>
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div class="uHMk8b">
                  <div role="checkbox" class="uHMk8b" aria-checked="false" aria-label="Python" tabindex="0">
                    <div class="uHMk8b"></div>
                  </div>
                </div>
                <div class="aDTYNe">
                  <span class="M7eMe">Python</span>
                </div>
              </label>
            </div>
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div class="uHMk8b">
                  <div role="checkbox" class="uHMk8b" aria-checked="false" aria-label="Go" tabindex="0">
                    <div class="uHMk8b"></div>
                  </div>
                </div>
                <div class="aDTYNe">
                  <span class="M7eMe">Go</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    const jsCb = document.querySelectorAll('[role="checkbox"]')[0] as HTMLElement;
    const pyCb = document.querySelectorAll('[role="checkbox"]')[1] as HTMLElement;
    const goCb = document.querySelectorAll('[role="checkbox"]')[2] as HTMLElement;

    const jsClick = vi.fn(() => jsCb.setAttribute('aria-checked', 'true'));
    const pyClick = vi.fn(() => pyCb.setAttribute('aria-checked', 'true'));
    const goClick = vi.fn(() => goCb.setAttribute('aria-checked', 'true'));

    jsCb.addEventListener('click', jsClick);
    pyCb.addEventListener('click', pyClick);
    goCb.addEventListener('click', goClick);

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);
    expect(fields[0].controlType).toBe('checkbox');
    expect(fields[0].selectionMode).toBe('multiple');
    expect(fields[0].label).toBe('Preferred Languages');
    expect(fields[0].options?.map((o) => o.label)).toEqual(['JavaScript', 'Python', 'Go']);

    const fillResult = await fillFormFields(
      { [fields[0].id]: ['JavaScript', 'Go'] },
      fields,
      document,
    );

    expect(fillResult.status).toBe('success');
    expect(jsClick).toHaveBeenCalled();
    expect(pyClick).not.toHaveBeenCalled();
    expect(goClick).toHaveBeenCalled();
  });

  it('handles Google Forms checkboxes with Other: custom answer', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div class="geS5n">
          <div class="M7eMe" role="heading" aria-level="3">Frameworks</div>
          <div role="group" aria-label="Frameworks">
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div class="uHMk8b">
                  <div role="checkbox" class="uHMk8b" aria-checked="false" aria-label="React" tabindex="0">
                    <div class="uHMk8b"></div>
                  </div>
                </div>
                <div class="aDTYNe">
                  <span class="M7eMe">React</span>
                </div>
              </label>
            </div>
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div class="uHMk8b">
                  <div role="checkbox" class="uHMk8b" aria-checked="false" aria-label="Other:" data-value="__other_option__" tabindex="0">
                    <div class="uHMk8b"></div>
                  </div>
                </div>
                <div class="aDTYNe">
                  <span class="M7eMe">Other:</span>
                </div>
              </label>
              <input type="text" class="Hvn9fb" aria-label="Other response" />
            </div>
          </div>
        </div>
      </div>
    `;

    const reactCb = document.querySelectorAll('[role="checkbox"]')[0] as HTMLElement;
    const otherCb = document.querySelectorAll('[role="checkbox"]')[1] as HTMLElement;

    const reactClick = vi.fn(() => reactCb.setAttribute('aria-checked', 'true'));
    const otherClick = vi.fn(() => otherCb.setAttribute('aria-checked', 'true'));

    reactCb.addEventListener('click', reactClick);
    otherCb.addEventListener('click', otherClick);

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);

    const fillResult = await fillFormFields(
      { [fields[0].id]: ['Other: Svelte'] },
      fields,
      document,
    );

    expect(fillResult.status).toBe('success');
    expect(otherClick).toHaveBeenCalled();
    const otherInput = document.querySelector<HTMLInputElement>('.Hvn9fb');
    expect(otherInput?.value).toBe('Svelte');
  });

  it('handles Google Forms checkboxes when wrapper is a div and text is in .aDTYNe', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div class="geS5n">
          <div class="M7eMe" role="heading" aria-level="3">Tools</div>
          <div role="group" aria-label="Tools">
            <div class="docssharedWizToggleLabeledControl">
              <div class="docssharedWizToggleLabeledLabelWrapper">
                <div class="uHMk8b">
                  <div role="checkbox" class="uHMk8b" aria-checked="false" aria-label="Docker" tabindex="0">
                  </div>
                </div>
                <div class="aDTYNe">
                  <span class="M7eMe">Docker</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const dockerCb = document.querySelector('[role="checkbox"]') as HTMLElement;
    const dockerClick = vi.fn(() => dockerCb.setAttribute('aria-checked', 'true'));
    dockerCb.addEventListener('click', dockerClick);

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);
    expect(fields[0].options?.[0].label).toBe('Docker');

    const fillResult = await fillFormFields(
      { [fields[0].id]: ['Docker'] },
      fields,
      document,
    );

    expect(fillResult.status).toBe('success');
    expect(dockerClick).toHaveBeenCalled();
  });

  it('detects and fills multi-select checkboxes when string[] is passed', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div class="geS5n">
          <div class="M7eMe" role="heading" aria-level="3">Single Pick Checkbox</div>
          <div role="group" aria-label="Single Pick Checkbox">
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div role="checkbox" aria-checked="false" aria-label="TypeScript"></div>
                <span class="M7eMe">TypeScript</span>
              </label>
            </div>
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div role="checkbox" aria-checked="false" aria-label="Python"></div>
                <span class="M7eMe">Python</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    const tsCb = document.querySelectorAll('[role="checkbox"]')[0] as HTMLElement;
    const pyCb = document.querySelectorAll('[role="checkbox"]')[1] as HTMLElement;
    const tsClick = vi.fn(() => tsCb.setAttribute('aria-checked', 'true'));
    const pyClick = vi.fn(() => pyCb.setAttribute('aria-checked', 'true'));
    tsCb.addEventListener('click', tsClick);
    pyCb.addEventListener('click', pyClick);

    const fields = extractFormFields(document);
    expect(fields[0].controlType).toBe('checkbox');
    expect(fields[0].selectionMode).toBe('multiple');

    const fillResult = await fillFormFields(
      { [fields[0].id]: ['TypeScript'] },
      fields,
      document,
    );

    expect(fillResult.status).toBe('success');
    expect(tsClick).toHaveBeenCalled();
    expect(pyClick).not.toHaveBeenCalled();
  });

  it('detects and fills Google Forms Tick Box Grid (matrix of checkbox rows)', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div class="geS5n">
          <div class="M7eMe" role="heading" aria-level="3">Rate your skills across domains</div>
          <div role="group" aria-label="Frontend Skills">
            <div role="checkbox" aria-checked="false" aria-label="HTML/CSS" data-value="HTML/CSS">HTML/CSS</div>
            <div role="checkbox" aria-checked="false" aria-label="JavaScript" data-value="JavaScript">JavaScript</div>
            <div role="checkbox" aria-checked="false" aria-label="React" data-value="React">React</div>
          </div>
          <div role="group" aria-label="Backend Skills">
            <div role="checkbox" aria-checked="false" aria-label="Node.js" data-value="Node.js">Node.js</div>
            <div role="checkbox" aria-checked="false" aria-label="SQL" data-value="SQL">SQL</div>
            <div role="checkbox" aria-checked="false" aria-label="Docker" data-value="Docker">Docker</div>
          </div>
        </div>
      </div>
    `;

    const checkboxes = document.querySelectorAll('[role="checkbox"]');
    checkboxes.forEach((cb) => {
      cb.addEventListener('click', () => {
        const current = cb.getAttribute('aria-checked') === 'true';
        cb.setAttribute('aria-checked', String(!current));
      });
    });

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(2);
    expect(fields.map((f) => f.label)).toEqual(['Frontend Skills', 'Backend Skills']);
    expect(fields.every((f) => f.controlType === 'checkbox')).toBe(true);

    const fillResult = await fillFormFields(
      {
        [fields[0].id]: ['HTML/CSS', 'React'],
        [fields[1].id]: ['Node.js', 'Docker'],
      },
      fields,
      document,
    );

    expect(fillResult.status).toBe('success');
    expect(checkboxes[0].getAttribute('aria-checked')).toBe('true');
    expect(checkboxes[1].getAttribute('aria-checked')).toBe('false');
    expect(checkboxes[2].getAttribute('aria-checked')).toBe('true');
    expect(checkboxes[3].getAttribute('aria-checked')).toBe('true');
    expect(checkboxes[4].getAttribute('aria-checked')).toBe('false');
    expect(checkboxes[5].getAttribute('aria-checked')).toBe('true');
  });

  it('detects and fills Google Forms Radio tick options (single-choice)', async () => {
    document.body.innerHTML = `
      <div role="listitem" class="QrToBd">
        <div class="geS5n">
          <div class="M7eMe" role="heading" aria-level="3">Experience Level</div>
          <div role="radiogroup" aria-label="Experience Level">
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div class="uHMk8b">
                  <div role="radio" class="uHMk8b" aria-checked="false" aria-label="Entry Level" data-value="Entry Level" tabindex="0">
                  </div>
                </div>
                <div class="aDTYNe">
                  <span class="M7eMe">Entry Level</span>
                </div>
              </label>
            </div>
            <div class="eCGGMc">
              <label class="docssharedWizToggleLabeledLabelWrapper">
                <div class="uHMk8b">
                  <div role="radio" class="uHMk8b" aria-checked="false" aria-label="Senior" data-value="Senior" tabindex="0">
                  </div>
                </div>
                <div class="aDTYNe">
                  <span class="M7eMe">Senior</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    `;

    const entryRadio = document.querySelectorAll('[role="radio"]')[0] as HTMLElement;
    const seniorRadio = document.querySelectorAll('[role="radio"]')[1] as HTMLElement;

    entryRadio.addEventListener('click', () => {
      entryRadio.setAttribute('aria-checked', 'true');
      seniorRadio.setAttribute('aria-checked', 'false');
    });
    seniorRadio.addEventListener('click', () => {
      entryRadio.setAttribute('aria-checked', 'false');
      seniorRadio.setAttribute('aria-checked', 'true');
    });

    const fields = extractFormFields(document);
    expect(fields).toHaveLength(1);
    expect(fields[0].controlType).toBe('radio');
    expect(fields[0].selectionMode).toBe('single');
    expect(fields[0].options?.map((o) => o.label)).toEqual(['Entry Level', 'Senior']);

    const fillResult = await fillFormFields(
      { [fields[0].id]: 'Senior' },
      fields,
      document,
    );

    expect(fillResult.status).toBe('success');
    expect(seniorRadio.getAttribute('aria-checked')).toBe('true');
    expect(entryRadio.getAttribute('aria-checked')).toBe('false');
  });
});
