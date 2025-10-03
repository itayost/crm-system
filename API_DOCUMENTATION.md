# CRM Public API Documentation

## Overview

The CRM Public API allows external websites and applications to submit leads directly to the CRM system. This documentation covers the public endpoints that don't require authentication.

**Base URL:** `https://your-crm-domain.com/api`

## Quick Start

```bash
curl -X POST https://your-crm-domain.com/api/public/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "phone": "0501234567",
    "email": "john@example.com",
    "source": "WEBSITE"
  }'
```

---

## Endpoints

### Create Lead

Submit a new lead to the CRM system.

**Endpoint:** `POST /api/public/leads`

**Content-Type:** `application/json`

**CORS:** Enabled - supports cross-origin requests from any domain

#### Request Body

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `name` | string | ✅ **Yes** | Lead's full name | Minimum 1 character |
| `phone` | string | ✅ **Yes** | Phone number (Israeli format) | 9-10 digits, spaces/dashes auto-removed |
| `email` | string | ⭕ Optional | Email address | Valid email format if provided |
| `company` | string | ⭕ Optional | Company name | - |
| `projectType` | string | ⭕ Optional | Type of project interest | See Project Types below |
| `estimatedBudget` | number | ⭕ Optional | Estimated budget in ILS | Positive number |
| `notes` | string | ⭕ Optional | Additional information | - |
| `source` | string | ⭕ Optional | Lead source | See Sources below, defaults to "WEBSITE" |

#### Project Types
- `LANDING_PAGE` - Landing page
- `WEBSITE` - Website
- `ECOMMERCE` - E-commerce site
- `WEB_APP` - Web application
- `MOBILE_APP` - Mobile application
- `MANAGEMENT_SYSTEM` - Management system
- `CONSULTATION` - Consultation services

#### Lead Sources
- `WEBSITE` - Website form (default)
- `PHONE` - Phone call
- `WHATSAPP` - WhatsApp message
- `REFERRAL` - Referral from existing client
- `OTHER` - Other source

#### Example Request

```json
{
  "name": "ישראל ישראלי",
  "phone": "050-123-4567",
  "email": "israel@example.com",
  "company": "חברת ישראל בע״ם",
  "projectType": "WEB_APP",
  "estimatedBudget": 50000,
  "notes": "מעוניין באפליקציית ניהול מלאי",
  "source": "WEBSITE"
}
```

#### Success Response

**Status Code:** `201 Created`

```json
{
  "success": true,
  "message": "הליד נוצר בהצלחה! ניצור איתך קשר בקרוב.",
  "data": {
    "id": "clx1234567890"
  }
}
```

#### Error Responses

**Status Code:** `400 Bad Request` - Validation Error

```json
{
  "error": "נתונים לא תקינים: מספר טלפון חייב להיות 9-10 ספרות"
}
```

**Status Code:** `500 Internal Server Error`

```json
{
  "error": "שגיאה ביצירת הליד. נסה שוב מאוחר יותר."
}
```

---

## Integration Examples

### JavaScript (Vanilla)

```javascript
async function submitLead(formData) {
  try {
    const response = await fetch('https://your-crm-domain.com/api/public/leads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: formData.name,
        phone: formData.phone,
        email: formData.email || undefined,
        company: formData.company || undefined,
        projectType: formData.projectType || undefined,
        estimatedBudget: formData.budget ? Number(formData.budget) : undefined,
        notes: formData.notes || undefined,
        source: 'WEBSITE'
      })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('Lead created successfully:', result);
      return { success: true, data: result };
    } else {
      console.error('Error creating lead:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Network error:', error);
    return { success: false, error: 'שגיאה בחיבור לשרת' };
  }
}

// Usage
const formData = {
  name: 'ישראל ישראלי',
  phone: '0501234567',
  email: 'israel@example.com'
};

submitLead(formData).then(result => {
  if (result.success) {
    alert('תודה! נחזור אליך בקרוב');
  } else {
    alert(result.error);
  }
});
```

### React Hook

```jsx
import { useState } from 'react';

export function useLeadSubmission() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submitLead = async (leadData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_CRM_URL}/api/public/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...leadData,
          estimatedBudget: leadData.estimatedBudget ?
            Number(leadData.estimatedBudget) : undefined,
          source: 'WEBSITE'
        })
      });

      const result = await response.json();

      if (response.ok) {
        return { success: true, data: result };
      } else {
        setError(result.error);
        return { success: false, error: result.error };
      }
    } catch (err) {
      const errorMsg = 'שגיאה בחיבור לשרת';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return { submitLead, loading, error };
}

// Usage in component
function ContactForm() {
  const { submitLead, loading, error } = useLeadSubmission();

  const handleSubmit = async (formData) => {
    const result = await submitLead(formData);
    if (result.success) {
      // Handle success
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'שולח...' : 'שלח'}
      </button>
    </form>
  );
}
```

### PHP (WordPress)

```php
function submit_lead_to_crm($lead_data) {
    $crm_url = 'https://your-crm-domain.com/api/public/leads';

    $data = array(
        'name' => sanitize_text_field($lead_data['name']),
        'phone' => sanitize_text_field($lead_data['phone']),
        'email' => sanitize_email($lead_data['email']),
        'company' => sanitize_text_field($lead_data['company']),
        'projectType' => sanitize_text_field($lead_data['projectType']),
        'estimatedBudget' => intval($lead_data['estimatedBudget']),
        'notes' => sanitize_textarea_field($lead_data['notes']),
        'source' => 'WEBSITE'
    );

    // Remove empty values
    $data = array_filter($data, function($value) {
        return !empty($value);
    });

    $response = wp_remote_post($crm_url, array(
        'headers' => array(
            'Content-Type' => 'application/json'
        ),
        'body' => json_encode($data),
        'timeout' => 15
    ));

    if (is_wp_error($response)) {
        return array(
            'success' => false,
            'error' => 'שגיאה בחיבור לשרת'
        );
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $result = json_decode($response_body, true);

    if ($response_code === 201) {
        return array(
            'success' => true,
            'data' => $result
        );
    } else {
        return array(
            'success' => false,
            'error' => $result['error'] ?? 'שגיאה לא ידועה'
        );
    }
}

// Usage with Contact Form 7
add_action('wpcf7_mail_sent', function($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    if (!$submission) return;

    $data = $submission->get_posted_data();

    $lead_data = array(
        'name' => $data['your-name'] ?? '',
        'phone' => $data['your-phone'] ?? '',
        'email' => $data['your-email'] ?? '',
        'company' => $data['your-company'] ?? '',
        'projectType' => $data['project-type'] ?? '',
        'estimatedBudget' => $data['budget'] ?? 0,
        'notes' => $data['your-message'] ?? ''
    );

    $result = submit_lead_to_crm($lead_data);

    if (!$result['success']) {
        error_log('CRM Lead Submission Failed: ' . $result['error']);
    }
});
```

### cURL Command

```bash
# Basic lead submission
curl -X POST https://your-crm-domain.com/api/public/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ישראל ישראלי",
    "phone": "0501234567",
    "email": "israel@example.com",
    "source": "WEBSITE"
  }'

# Complete lead with all fields
curl -X POST https://your-crm-domain.com/api/public/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ישראל ישראלי",
    "phone": "050-123-4567",
    "email": "israel@example.com",
    "company": "חברת ישראל בע״ם",
    "projectType": "WEB_APP",
    "estimatedBudget": 50000,
    "notes": "מעוניין באפליקציית ניהול מלאי עם אינטגרציה למערכת ERP קיימת",
    "source": "WEBSITE"
  }'
```

---

## Validation Rules

### Phone Number Validation
- **Format:** Israeli phone numbers (9-10 digits)
- **Accepted formats:**
  - `0501234567`
  - `050-123-4567`
  - `050 123 4567`
  - `+972501234567` (plus sign and spaces/dashes are removed)
- **Auto-cleanup:** Spaces, dashes, and plus signs are automatically removed
- **Validation regex:** `/^[0-9]{9,10}$/`

### Email Validation
- Standard email format validation
- Optional field - can be `null`, `undefined`, or omitted
- If provided, must be a valid email address

### Budget Validation
- Must be a positive number
- Optional field
- Converted to integer for storage

---

## Error Handling

### Common Error Scenarios

1. **Missing Required Fields**
   ```json
   {
     "error": "נתונים לא תקינים: שם חובה"
   }
   ```

2. **Invalid Phone Number**
   ```json
   {
     "error": "נתונים לא תקינים: מספר טלפון חייב להיות 9-10 ספרות"
   }
   ```

3. **Invalid Email Format**
   ```json
   {
     "error": "נתונים לא תקינים: אימייל לא תקין"
   }
   ```

4. **Server Error**
   ```json
   {
     "error": "שגיאה ביצירת הליד. נסה שוב מאוחר יותר."
   }
   ```

### Best Practices for Error Handling

1. **Always check response status** before processing the result
2. **Display Hebrew error messages** to users for better UX
3. **Log errors** for debugging but don't expose technical details to users
4. **Implement retry logic** for network failures
5. **Validate data client-side** before sending to reduce API calls

---

## CORS Configuration

The API supports Cross-Origin Resource Sharing (CORS) with the following configuration:

- **Access-Control-Allow-Origin:** `*` (all domains)
- **Access-Control-Allow-Methods:** `POST, OPTIONS`
- **Access-Control-Allow-Headers:** `Content-Type`

This allows the API to be called from any website domain.

---

## Rate Limiting

Currently, there are no rate limits enforced on the public leads endpoint. However, it's recommended to:

1. **Implement client-side validation** to prevent unnecessary API calls
2. **Add anti-spam measures** like reCAPTCHA for public forms
3. **Monitor API usage** to detect abuse patterns

---

## Testing

### Test Lead Data

Use this test data to verify your integration:

```json
{
  "name": "בדיקה טסט",
  "phone": "0501234567",
  "email": "test@example.com",
  "company": "חברת בדיקות",
  "projectType": "WEBSITE",
  "estimatedBudget": 10000,
  "notes": "זהו ליד לבדיקה",
  "source": "WEBSITE"
}
```

### Verification Steps

1. **Submit the test lead** using your integration
2. **Check the response** for success status and lead ID
3. **Verify in CRM dashboard** that the lead appears in the leads list
4. **Test error scenarios** with invalid data (missing name, invalid phone, etc.)

---

## Support

For technical support or questions about the API:

1. **Check the CRM documentation** in the repository
2. **Test with the provided examples** to isolate issues
3. **Verify your CRM deployment** is accessible and running
4. **Check browser console** for JavaScript errors
5. **Review server logs** for backend issues

---

## Changelog

### Version 1.0
- Initial public API release
- Lead creation endpoint
- CORS support
- Hebrew validation messages
- Support for all lead sources and project types