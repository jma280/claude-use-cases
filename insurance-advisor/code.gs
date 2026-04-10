function onFormSubmit(e) {
  var responses = e.response.getItemResponses();
  var situation = '';
  var userEmail = '';

  for (var i = 0; i < responses.length; i++) {
    var question = responses[i].getItem().getTitle();
    var answer = responses[i].getResponse();
    if (question === 'Describe your situation') situation = answer;
    if (question === 'Your email address') userEmail = answer;
  }

  // Store your Anthropic API key here
  // For better security, consider using Script Properties instead:
  // var apiKey = PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  var apiKey = 'YOUR_API_KEY_HERE';

  // Replace the policy details below with your own
  var systemPrompt = `You are an insurance coverage analyst. The user has the following active policies:

1. AUTO POLICY
   - [Your vehicles]
   - [Your coverage limits and deductibles]

2. HOMEOWNERS POLICY
   - [Your property address]
   - [Your coverage amounts and deductibles]
   - [Key exclusions]

3. ADDITIONAL POLICIES
   - [Any other policies and their details]

Analyze the situation and respond in plain English with: whether it is covered, which policy applies, the relevant limits and deductibles, and any important exclusions or gaps. Keep it concise and clear.`;

  var payload = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: situation }]
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify(payload)
  };

  var response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
  var result = JSON.parse(response.getContentText());
  var answer = result.content[0].text;

  var subject = 'Your insurance coverage question';
  var body = 'You asked:\n\n"' + situation + '"\n\n---\n\n' + answer + '\n\n---\nThis is a general guidance tool only. For claims contact your insurer directly.';

  MailApp.sendEmail(userEmail, subject, body);
}
