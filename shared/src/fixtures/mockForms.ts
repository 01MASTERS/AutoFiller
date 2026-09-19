/**
 * Multi-Platform HTML Mock Form Fixtures
 * Realistic HTML application forms for Greenhouse, Lever, Workday,
 * Generic HTML5 Career Portals, and Google Forms.
 *
 * Used for both live manual testing in the browser via backend test endpoints
 * and automated Vitest E2E verification suites.
 */

export const mockGreenhouseFormHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Acme Corp Careers — Senior Frontend Engineer (Greenhouse)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; padding: 30px; margin: 0; color: #1e293b; }
    .gh-card { max-width: 680px; margin: auto; background: #ffffff; border-radius: 10px; padding: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    h1 { font-size: 24px; margin-top: 0; margin-bottom: 8px; color: #0f172a; }
    .subtitle { color: #64748b; font-size: 14px; margin-bottom: 28px; }
    .field-group { margin-bottom: 20px; }
    label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #334155; }
    .required { color: #ef4444; }
    input[type="text"], input[type="email"], input[type="tel"], textarea, select {
      width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.15s;
    }
    input:focus, textarea:focus, select:focus { border-color: #2563eb; }
    .attach-or-paste { border: 2px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; background: #f8fafc; cursor: pointer; }
    .select2-container { margin-top: 4px; }
    .section-title { font-size: 18px; font-weight: 700; margin-top: 32px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
  </style>
</head>
<body>
  <div class="gh-card">
    <h1>Senior Frontend Engineer</h1>
    <div class="subtitle">Acme Corporation · San Francisco, CA / Remote</div>

    <form id="application_form" action="/jobs/123/apply" method="POST" enctype="multipart/form-data">
      <div id="flash_wrapper"></div>

      <!-- Personal Info -->
      <div class="field-group">
        <label for="first_name">First Name <span class="required">*</span></label>
        <input type="text" id="first_name" name="job_application[first_name]" required autocomplete="given-name" />
      </div>

      <div class="field-group">
        <label for="last_name">Last Name <span class="required">*</span></label>
        <input type="text" id="last_name" name="job_application[last_name]" required autocomplete="family-name" />
      </div>

      <div class="field-group">
        <label for="email">Email <span class="required">*</span></label>
        <input type="email" id="email" name="job_application[email]" required autocomplete="email" />
      </div>

      <div class="field-group">
        <label for="phone">Phone <span class="required">*</span></label>
        <input type="tel" id="phone" name="job_application[phone]" required autocomplete="tel" />
      </div>

      <!-- Resume Dropzone -->
      <div class="field-group">
        <label>Resume/CV <span class="required">*</span></label>
        <div id="resume" class="attach-or-paste" data-provides="upload">
          <span>Attach, Dropbox, or Google Drive</span>
          <input type="file" id="resume_file" name="job_application[resume]" style="margin-top: 8px;" />
        </div>
      </div>

      <!-- Social / Profile Links -->
      <div class="field-group">
        <label for="job_application_answers_attributes_0_text_value">LinkedIn Profile</label>
        <input type="text" id="job_application_answers_attributes_0_text_value" name="job_application[answers_attributes][0][text_value]" placeholder="https://linkedin.com/in/username" />
      </div>

      <div class="field-group">
        <label for="job_application_answers_attributes_1_text_value">GitHub Profile</label>
        <input type="text" id="job_application_answers_attributes_1_text_value" name="job_application[answers_attributes][1][text_value]" placeholder="https://github.com/username" />
      </div>

      <div class="field-group">
        <label for="job_application_answers_attributes_2_text_value">Website or Portfolio</label>
        <input type="text" id="job_application_answers_attributes_2_text_value" name="job_application[answers_attributes][2][text_value]" placeholder="https://portfolio.me" />
      </div>

      <!-- Custom Questions -->
      <div class="field-group">
        <label for="why_acme">Why are you interested in joining Acme Corp?</label>
        <textarea id="why_acme" name="job_application[answers_attributes][3][text_value]" rows="3"></textarea>
      </div>

      <!-- Demographics / EEO -->
      <div class="section-title">Voluntary Self-Identification</div>
      <div id="eeoc_fields">
        <div class="field-group">
          <label for="job_application_gender">Gender</label>
          <div class="select2-container">
            <select id="job_application_gender" name="job_application[gender]">
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="nonbinary">Non-Binary</option>
              <option value="decline">Decline to Self-Identify</option>
            </select>
          </div>
        </div>

        <div class="field-group">
          <label for="job_application_race">Race / Ethnicity</label>
          <select id="job_application_race" name="job_application[race]">
            <option value="">Select...</option>
            <option value="asian">Asian</option>
            <option value="white">White</option>
            <option value="black">Black or African American</option>
            <option value="hispanic">Hispanic or Latino</option>
            <option value="decline">Decline to State</option>
          </select>
        </div>

        <div class="field-group">
          <label for="job_application_veteran_status">Veteran Status</label>
          <select id="job_application_veteran_status" name="job_application[veteran_status]">
            <option value="">Select...</option>
            <option value="veteran">I am a veteran</option>
            <option value="not_veteran">I am not a veteran</option>
            <option value="decline">Decline to State</option>
          </select>
        </div>
      </div>

      <div style="margin-top: 24px;">
        <button type="submit" id="submit_app" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer;">
          Submit Application
        </button>
      </div>
    </form>
  </div>
</body>
</html>`;

export const mockLeverFormHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hooli — Senior Staff Engineer (Lever)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafafa; padding: 30px; margin: 0; color: #222; }
    .lever-job-page { max-width: 650px; margin: auto; background: #fff; border-radius: 8px; padding: 36px; border: 1px solid #eaeaea; }
    h2 { font-size: 22px; margin-top: 0; margin-bottom: 4px; }
    .section-title { font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-top: 30px; margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .form-row { margin-bottom: 18px; }
    input[type="text"], input[type="email"], input[type="tel"] {
      width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;
    }
    .lever-radio-group, .lever-checkbox-group { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }
    .lever-radio-label, .lever-checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }
    .card-field-title { font-weight: 600; font-size: 14px; display: block; margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="lever-job-page">
    <h2>Apply for Senior Staff Engineer</h2>
    <div style="color: #888; font-size: 14px; margin-bottom: 24px;">Palo Alto, CA / Engineering</div>

    <form id="application-form" action="https://jobs.lever.co/hooli/apply" method="POST">
      <!-- Section Candidate Info -->
      <div class="section-title">Candidate Information</div>
      <div class="section-candidate-wrapper">
        <div class="form-row">
          <input type="text" name="name" id="lever-name" placeholder="Full name *" required />
        </div>
        <div class="form-row">
          <input type="email" name="email" id="lever-email" placeholder="Email *" required />
        </div>
        <div class="form-row">
          <input type="tel" name="phone" id="lever-phone" placeholder="Phone" />
        </div>
        <div class="form-row">
          <input type="text" name="org" id="lever-org" placeholder="Current company" />
        </div>
      </div>

      <!-- Section Links -->
      <div class="section-title">Links</div>
      <div class="section-links-wrapper">
        <div class="form-row">
          <input type="text" name="urls[LinkedIn]" id="lever-linkedin" placeholder="LinkedIn URL" />
        </div>
        <div class="form-row">
          <input type="text" name="urls[GitHub]" id="lever-github" placeholder="GitHub URL" />
        </div>
        <div class="form-row">
          <input type="text" name="urls[Portfolio]" id="lever-portfolio" placeholder="Portfolio URL" />
        </div>
      </div>

      <!-- Section Custom Questions -->
      <div class="section-title">Additional Questions</div>
      <div class="section-custom-questions">
        <div class="application-question form-row">
          <span class="card-field-title">Are you legally authorized to work in the United States? *</span>
          <div class="lever-radio-group">
            <label class="lever-radio-label">
              <input type="radio" name="authorized_us" value="yes" style="opacity: 0; position: absolute;" />
              <span>Yes</span>
            </label>
            <label class="lever-radio-label">
              <input type="radio" name="authorized_us" value="no" style="opacity: 0; position: absolute;" />
              <span>No</span>
            </label>
          </div>
        </div>

        <div class="application-question form-row">
          <span class="card-field-title">Will you now or in the future require visa sponsorship? *</span>
          <div class="lever-radio-group">
            <label class="lever-radio-label">
              <input type="radio" name="visa_sponsorship" value="yes" style="opacity: 0; position: absolute;" />
              <span>Yes</span>
            </label>
            <label class="lever-radio-label">
              <input type="radio" name="visa_sponsorship" value="no" style="opacity: 0; position: absolute;" />
              <span>No</span>
            </label>
          </div>
        </div>
      </div>

      <!-- Section EEO -->
      <div class="section-title">Equal Employment Opportunity</div>
      <div class="section-eeo">
        <div class="form-row">
          <label class="card-field-title" for="lever-gender">Gender</label>
          <select id="lever-gender" name="eeo[gender]" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
            <option value="">Select an option</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="nonbinary">Non-binary</option>
            <option value="decline">I prefer not to say</option>
          </select>
        </div>
      </div>

      <div style="margin-top: 30px;">
        <button type="submit" style="background: #10b981; color: white; border: none; padding: 12px 28px; border-radius: 4px; font-weight: 600; cursor: pointer;">
          Submit Application
        </button>
      </div>
    </form>
  </div>
</body>
</html>`;

export const mockWorkdayFormHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Global Enterprises — Cloud Architect (Workday)</title>
  <style>
    body { font-family: "Workday Sans", Roboto, Arial, sans-serif; background: #f0f2f5; padding: 24px; margin: 0; }
    .workday-app { max-width: 720px; margin: auto; background: #fff; border-radius: 4px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
    .progress-bar { display: flex; list-style: none; padding: 0; margin-bottom: 30px; border-bottom: 2px solid #e0e0e0; }
    .progress-bar li { padding: 8px 16px; font-weight: 500; font-size: 14px; color: #757575; }
    .progress-bar li.active { color: #0056b3; border-bottom: 3px solid #0056b3; font-weight: 700; margin-bottom: -2px; }
    .wd-form-group { margin-bottom: 20px; }
    .wd-label { display: block; font-weight: 600; font-size: 14px; margin-bottom: 6px; color: #333; }
    input[data-automation-id="textInput"] {
      width: 100%; padding: 10px; border: 1px solid #b0b0b0; border-radius: 4px; font-size: 14px; box-sizing: border-box;
    }
    button[data-automation-id*="prompt"] {
      width: 100%; padding: 10px 12px; background: #fff; border: 1px solid #b0b0b0; border-radius: 4px; text-align: left; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 14px;
    }
    .popup-list { position: absolute; background: #fff; border: 1px solid #ccc; box-shadow: 0 4px 8px rgba(0,0,0,0.15); border-radius: 4px; z-index: 9999; max-height: 200px; overflow-y: auto; width: 300px; }
    .popup-option { padding: 10px 12px; cursor: pointer; font-size: 14px; }
    .popup-option:hover { background: #e8f0fe; }
  </style>
</head>
<body>
  <div data-automation-id="workdayApplicationRoot" class="workday-app">
    <!-- Wizard Progress Bar -->
    <ol data-automation-id="progressBar" class="progress-bar">
      <li data-automation-id="wizardStep" class="active" aria-current="step">My Information</li>
      <li data-automation-id="wizardStep">My Experience</li>
      <li data-automation-id="wizardStep">Application Questions</li>
      <li data-automation-id="wizardStep">Review</li>
    </ol>

    <h2>My Information</h2>

    <form data-automation-id="workdayForm">
      <!-- Legal Name Compound Fields -->
      <div data-automation-id="formField-legalNameSection_firstName" class="wd-form-group">
        <label data-automation-id="formLabel" for="legalNameSection_firstName" class="wd-label">First Name <abbr title="required">*</abbr></label>
        <input type="text" data-automation-id="textInput" id="legalNameSection_firstName" name="legalNameSection_firstName" required />
      </div>

      <div data-automation-id="formField-legalNameSection_lastName" class="wd-form-group">
        <label data-automation-id="formLabel" for="legalNameSection_lastName" class="wd-label">Last Name <abbr title="required">*</abbr></label>
        <input type="text" data-automation-id="textInput" id="legalNameSection_lastName" name="legalNameSection_lastName" required />
      </div>

      <!-- Contact Info -->
      <div data-automation-id="formField-email" class="wd-form-group">
        <label data-automation-id="formLabel" for="email" class="wd-label">Email Address <abbr title="required">*</abbr></label>
        <input type="email" data-automation-id="textInput" id="email" name="email" required />
      </div>

      <div data-automation-id="formField-phone-number" class="wd-form-group">
        <label data-automation-id="formLabel" for="phone-number" class="wd-label">Phone Number</label>
        <input type="tel" data-automation-id="textInput" id="phone-number" name="phone-number" />
      </div>

      <!-- Address Section -->
      <div data-automation-id="formField-addressSection_city" class="wd-form-group">
        <label data-automation-id="formLabel" for="addressSection_city" class="wd-label">City</label>
        <input type="text" data-automation-id="textInput" id="addressSection_city" name="addressSection_city" />
      </div>

      <!-- Prompt Select Button Combobox -->
      <div data-automation-id="formField-country" class="wd-form-group">
        <label data-automation-id="formLabel" id="country-lbl" class="wd-label">Country <abbr title="required">*</abbr></label>
        <button type="button" data-automation-id="select-country-prompt" aria-labelledby="country-lbl" aria-haspopup="listbox" aria-expanded="false">
          <span data-automation-id="prompt-selected-value">Select a Country</span>
          <span>▼</span>
        </button>
      </div>

      <div style="margin-top: 28px;">
        <button type="button" data-automation-id="bottom-navigation-next-button" style="background: #0056b3; color: white; border: none; padding: 12px 24px; border-radius: 4px; font-weight: 600; cursor: pointer;">
          Save and Continue
        </button>
      </div>
    </form>
  </div>

  <!-- Body Portal Dropdown (Workday Popover) -->
  <div data-automation-id="popupList" role="listbox" class="popup-list" style="display: none;">
    <div role="option" data-automation-id="prompt-option-US" class="popup-option">United States of America</div>
    <div role="option" data-automation-id="prompt-option-CA" class="popup-option">Canada</div>
    <div role="option" data-automation-id="prompt-option-UK" class="popup-option">United Kingdom</div>
  </div>
</body>
</html>`;

export const mockCareerFormHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Modern Tech Co — Job Application (Standard HTML5)</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f3f4f6; padding: 30px; margin: 0; color: #111827; }
    .career-card { max-width: 640px; margin: auto; background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    fieldset { border: 1px solid #e5e7eb; border-radius: 6px; padding: 20px; margin-bottom: 24px; }
    legend { font-weight: 700; color: #374151; padding: 0 8px; }
    .field { margin-bottom: 16px; }
    label { display: block; font-weight: 500; font-size: 14px; margin-bottom: 6px; }
    input[type="text"], input[type="email"], input[type="tel"], select, textarea {
      width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;
    }
    .options-group { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
    .choice-label { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="career-card">
    <h1>Software Engineer Application</h1>

    <form id="career-form">
      <fieldset>
        <legend>Contact Information</legend>
        <div class="field">
          <label for="applicant-name">Full Name *</label>
          <input type="text" id="applicant-name" name="name" required />
        </div>
        <div class="field">
          <label for="applicant-email">Email Address *</label>
          <input type="email" id="applicant-email" name="email" required />
        </div>
        <div class="field">
          <label for="applicant-phone">Phone Number</label>
          <input type="tel" id="applicant-phone" name="phone" />
        </div>
      </fieldset>

      <fieldset>
        <legend>Experience & Qualifications</legend>
        <div class="field">
          <label for="primary-role">Target Role</label>
          <select id="primary-role" name="role">
            <option value="">Select your role...</option>
            <option value="frontend">Frontend Developer</option>
            <option value="backend">Backend Developer</option>
            <option value="fullstack">Fullstack Engineer</option>
            <option value="devops">DevOps Engineer</option>
          </select>
        </div>

        <div class="field">
          <label>Years of Professional Experience</label>
          <div class="options-group">
            <label class="choice-label"><input type="radio" name="years_exp" value="0-2" /> 0-2 years</label>
            <label class="choice-label"><input type="radio" name="years_exp" value="3-5" /> 3-5 years</label>
            <label class="choice-label"><input type="radio" name="years_exp" value="5+" /> 5+ years</label>
          </div>
        </div>

        <div class="field">
          <label>Core Technical Skills</label>
          <div class="options-group">
            <label class="choice-label"><input type="checkbox" name="skills" value="ts" /> TypeScript</label>
            <label class="choice-label"><input type="checkbox" name="skills" value="react" /> React</label>
            <label class="choice-label"><input type="checkbox" name="skills" value="node" /> Node.js</label>
            <label class="choice-label"><input type="checkbox" name="skills" value="python" /> Python</label>
          </div>
        </div>

        <div class="field">
          <label for="applicant-bio">Cover Note / Bio</label>
          <textarea id="applicant-bio" name="bio" rows="3"></textarea>
        </div>
      </fieldset>

      <button type="submit" style="background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; cursor: pointer;">
        Submit Application
      </button>
    </form>
  </div>
</body>
</html>`;

export const mockGoogleFormHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Google Form QA Test Fixture — AutoFiller</title>
  <style>
    body { font-family: sans-serif; background: #f1f5f9; padding: 30px; max-width: 600px; margin: auto; }
    .form-card { background: white; padding: 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    h1 { color: #1e293b; font-size: 20px; margin-bottom: 20px; }
    .item { margin-bottom: 20px; }
    .heading { font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #334155; }
    input, textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; }
    .required-star { color: #ef4444; }
  </style>
</head>
<body>
  <div class="form-card">
    <h1>AutoFiller Test Form (Google Form Fixture)</h1>
    <form>
      <div role="listitem" class="item">
        <div role="heading" class="heading">Full Name <span class="required-star">*</span></div>
        <input type="text" name="entry.101" aria-label="Full Name" required placeholder="Enter your full name" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Email Address <span class="required-star">*</span></div>
        <input type="email" name="entry.102" aria-label="Email Address" required placeholder="name@example.com" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Phone Number</div>
        <input type="tel" name="entry.103" aria-label="Phone Number" placeholder="(555) 000-0000" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Alternate Phone Number</div>
        <input type="tel" name="entry.105" aria-label="Alternate Phone Number" placeholder="(555) 000-0000" />
      </div>

      <div role="listitem" class="item">
        <div role="heading" class="heading">Short Bio</div>
        <textarea name="entry.104" aria-label="Short Bio" placeholder="Tell us about yourself..."></textarea>
      </div>
    </form>
  </div>
</body>
</html>`;
