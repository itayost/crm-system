# CRM Public API Documentation

## Overview

The CRM Public API lets a website submit leads to the CRM. "Public" means it takes
no user session - not that it is open. Every submission must carry the shared
secret in `x-lead-secret`, so the call belongs on **your server**, never in a
browser: a secret shipped to the browser is not a secret, and there is no CORS
grant on this endpoint.

The shape is: visitor form -> your own server route -> this endpoint.

**Base URL:** `https://your-crm-domain.com/api`

## Quick Start

```bash
curl -X POST https://your-crm-domain.com/api/public/leads \
  -H "Content-Type: application/json" \
  -H "x-lead-secret: $PUBLIC_LEAD_SECRET" \
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

**Authentication:** `x-lead-secret: <PUBLIC_LEAD_SECRET>`, required. A missing or
wrong secret is `401`, and so is every request while the variable is unset on the
server - the endpoint fails closed rather than standing open.

**CORS:** none. Server-to-server only.

**Rate limit:** 10 submissions per minute per caller IP, then `429` with
`Retry-After`.

**One phone, one contact.** A submission whose phone already exists does not
create a second row:

- new number: the contact is created, `201`
- known number, something new in the submission: it is appended to that contact's
  notes and any blank field it fills is filled, `200`
- the same payload again within 10 minutes: nothing is written and no
  notification is sent, `200`

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

**Status Code:** `201 Created` (new contact) or `200 OK` (merged into an existing
contact, or a repeat that was ignored)

```json
{
  "success": true,
  "contact": {
    "id": "clx1234567890",
    "name": "ישראל ישראלי",
    "phone": "0501234567"
  }
}
```

#### Error Responses

**Status Code:** `401 Unauthorized` - missing or wrong `x-lead-secret`

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Status Code:** `400 Bad Request` - Validation Error

```json
{
  "success": false,
  "error": "מספר טלפון ישראלי לא תקין"
}
```

**Status Code:** `429 Too Many Requests` - rate limited, see `Retry-After`

```json
{
  "success": false,
  "error": "יותר מדי בקשות. אנא נסו שוב בעוד מספר דקות"
}
```

**Status Code:** `500 Internal Server Error`

```json
{
  "success": false,
  "error": "שגיאה בשליחת הטופס"
}
```

---

## Integration Examples

### Next.js (browser form + server route)

The browser posts to **your own** route; that route adds the secret and forwards.
This is how itayost.com does it, and it is the only supported shape - a `fetch`
straight from the page cannot carry the secret and will be rejected.

```ts
// app/api/leads/route.ts - your site, not the CRM
export async function POST(request: Request) {
  const lead = await request.json()

  const response = await fetch(process.env.CRM_API_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-lead-secret': process.env.CRM_LEAD_SECRET ?? '',
    },
    body: JSON.stringify({ ...lead, source: 'WEBSITE' }),
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    // Never surface the upstream body to the visitor: it can be an HTML error page.
    console.error('[leads] CRM returned', response.status)
    return Response.json(
      { success: false, error: 'שגיאה בשליחת הטופס. אנא נסו שוב' },
      { status: 502 }
    )
  }

  return Response.json({ success: true })
}
```

```ts
// The form component talks to your route only.
const res = await fetch('/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, phone, email }),
})
const result = await res.json()
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
            'Content-Type' => 'application/json',
            'x-lead-secret' => getenv('PUBLIC_LEAD_SECRET')
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

    if ($response_code === 201 || $response_code === 200) {
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
  -H "x-lead-secret: $PUBLIC_LEAD_SECRET" \
  -d '{
    "name": "ישראל ישראלי",
    "phone": "0501234567",
    "email": "israel@example.com",
    "source": "WEBSITE"
  }'

# Complete lead with all fields
curl -X POST https://your-crm-domain.com/api/public/leads \
  -H "Content-Type: application/json" \
  -H "x-lead-secret: $PUBLIC_LEAD_SECRET" \
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
- **Accepted:** one optional dash after the prefix (`0544994417`, `054-4994417`)
- **Stored:** digits only, in local form - `+972-54-499-4417` is saved as
  `0544994417`, which is also what the duplicate check matches on
- **Validation regex:** `/^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/`

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