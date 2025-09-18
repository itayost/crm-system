// CRM Lead Form JavaScript
(function() {
    // Configuration - Change this to your CRM URL
    const CRM_API_URL = 'https://crm-system-alpha-eight.vercel.app/api/public/leads';

    // Get form elements
    const form = document.getElementById('crm-lead-capture-form');
    const alertEl = document.getElementById('crm-alert');
    const loadingEl = document.getElementById('crm-loading');
    const submitBtn = form.querySelector('.crm-submit-btn');

    // Show alert message
    function showAlert(message, type) {
        alertEl.textContent = message;
        alertEl.className = `crm-alert ${type}`;
        alertEl.style.display = 'block';

        // Hide alert after 5 seconds for success
        if (type === 'success') {
            setTimeout(() => {
                alertEl.style.display = 'none';
            }, 5000);
        }
    }

    // Hide alert
    function hideAlert() {
        alertEl.style.display = 'none';
    }

    // Validate phone number
    function validatePhone(phone) {
        const phoneRegex = /^[0-9]{9,10}$/;
        return phoneRegex.test(phone.replace(/[-\s]/g, ''));
    }

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Hide any previous alerts
        hideAlert();

        // Get form data
        const formData = new FormData(form);
        const data = {
            name: formData.get('name')?.trim(),
            phone: formData.get('phone')?.trim().replace(/[-\s]/g, ''),
            email: formData.get('email')?.trim() || undefined,
            company: formData.get('company')?.trim() || undefined,
            projectType: formData.get('projectType') || undefined,
            estimatedBudget: formData.get('estimatedBudget') ?
                parseFloat(formData.get('estimatedBudget')) : undefined,
            notes: formData.get('notes')?.trim() || undefined,
            source: 'WEBSITE'
        };

        // Validation
        if (!data.name) {
            showAlert('נא להזין שם מלא', 'error');
            return;
        }

        if (!data.phone || !validatePhone(data.phone)) {
            showAlert('נא להזין מספר טלפון תקין (9-10 ספרות)', 'error');
            return;
        }

        if (data.email && !data.email.includes('@')) {
            showAlert('נא להזין כתובת אימייל תקינה', 'error');
            return;
        }

        // Show loading state
        loadingEl.classList.add('show');
        submitBtn.disabled = true;
        submitBtn.textContent = 'שולח...';

        try {
            // Send to API
            const response = await fetch(CRM_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Success
                showAlert(result.message || 'הטופס נשלח בהצלחה! ניצור איתך קשר בקרוב.', 'success');
                form.reset();

                // Track conversion if analytics is available
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'generate_lead', {
                        'event_category': 'engagement',
                        'event_label': 'CRM Lead Form'
                    });
                }

                if (typeof fbq !== 'undefined') {
                    fbq('track', 'Lead');
                }
            } else {
                // Error from server
                showAlert(result.message || 'אירעה שגיאה. נסה שוב מאוחר יותר.', 'error');
            }
        } catch (error) {
            // Network or other error
            console.error('Error submitting form:', error);
            showAlert('אירעה שגיאה בשליחת הטופס. נסה שוב מאוחר יותר.', 'error');
        } finally {
            // Reset loading state
            loadingEl.classList.remove('show');
            submitBtn.disabled = false;
            submitBtn.textContent = 'שלח';
        }
    });

    // Phone number formatting
    const phoneInput = document.getElementById('phone');
    phoneInput.addEventListener('input', (e) => {
        // Remove non-numeric characters
        let value = e.target.value.replace(/[^\d-]/g, '');

        // Format as Israeli phone number (optional)
        if (value.length === 10 && !value.includes('-')) {
            value = value.slice(0, 3) + '-' + value.slice(3);
        }

        e.target.value = value;
    });
})();