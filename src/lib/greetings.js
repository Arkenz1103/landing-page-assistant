// Instant replies for messages that are ONLY a greeting, thanks, goodbye, introduction or "who are you" (same patterns as
// the workflow's Quick Chat Check), so they never wait on n8n or Gemini. Anything else goes to the workflow.
// "ok" / "okay" are not handled here: after a "Which client do you mean?" menu they mean "yes".

const HELLO = '(?:hi+|hello|hey+|heya|hiya|yo|howdy|g ?day|good (?:morning|afternoon|evening|day))';
const THANKS = '(?:thanks|thank you|thx|cheers)';
const BYE = '(?:bye|goodbye)';
const GREET = `(?:${HELLO}|${THANKS}|${BYE})`;
const TAIL = '(?: there| mate| team| all| everyone| again)?';
const ABOUT = '(?:who are you|what are you|who is this|how are you(?: doing)?|how s it going|what can you do|what do you do|nice to meet you)';

const ONLY_GREETING = new RegExp(`^${GREET}${TAIL}(?: ${GREET}${TAIL})?$`);
const INTRO = new RegExp(`^(?:${GREET}${TAIL} )?(?:my name is|my name s|i am|i m|im|call me) ([a-z]+(?: [a-z]+)?)(?: ${ABOUT})?$`);
const ABOUT_ONLY = new RegExp(`^(?:${GREET}${TAIL} )?${ABOUT}(?: today)?$`);

// the assistant just asked something the next message may answer (the workflow keeps those turns)
const OPEN_QUESTION = /Which client (?:do you mean|would you like|should I)|Reply with the number|reply \*\*2\*\*/i;

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

function examples(client) {
  const name = client?.name || client?.sheet;
  const lines = name
    ? [`Where are we at for ${name}?`, `Who is assigned to ${name}?`, `Show the missing landing pages for ${name}`, `GMB link for ${name}`]
    : [
        'Where are we at for Yandina Station?',
        'Who is assigned to Bruin Pest Management?',
        'Show the September landing pages for Wagner Soil Testing',
        "Which months don't have landing pages for A Vision Windscreens?",
      ];
  return '**Try for example:**\n\n' + lines.map((l) => `- ${l}`).join('\n');
}

const HELP = 'I can help with client landing pages, project status, assignments, plans, reports and GMB links from the master sheet.';

/**
 * Returns an instant markdown reply for a pure greeting / small-talk message, or null when the workflow should answer.
 * `prior`: the chat's earlier messages; `client`: the chat's client ({ sheet, name }) when it is bound to one.
 */
export function localGreeting(text, { prior = [], client = null } = {}) {
  const t = String(text || '').toLowerCase().replace(/['’]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!t) return null;
  const lastAssistant = [...prior].reverse().find((m) => m.role === 'assistant');
  if (lastAssistant && OPEN_QUESTION.test(lastAssistant.content || '')) return null;

  const intro = t.match(INTRO);
  if (intro) {
    return `Nice to meet you, ${titleCase(intro[1])}! 👋 ${HELP}\n\n${examples(client)}`;
  }
  if (ABOUT_ONLY.test(t)) {
    if (/how are you|how s it going/.test(t)) return `I'm doing great, thanks for asking! 😊 ${HELP}\n\n${examples(client)}`;
    return `I'm the **Landing Page Assistant**. ${HELP} Include the client name in your question for the best results.\n\n${examples(client)}`;
  }
  if (!ONLY_GREETING.test(t)) return null;
  if (new RegExp(`^${BYE}`).test(t)) return pick(['Bye for now! 👋 Come back any time you need landing page info.', 'Goodbye! 👋 Happy to help again whenever you need.']);
  if (new RegExp(`^${THANKS}`).test(t)) return pick(["You're welcome! 😊 Anything else I can check for you?", 'No worries! Let me know if you need anything else.']);
  const forClient = client?.sheet ? ` What would you like to know about **${client.name || client.sheet}**?` : ' How can I help you today?';
  return pick(['Hi there! 👋', 'Hello! 👋', 'Hey! 👋']) + ` I'm your Landing Page Assistant.${forClient}\n\n${examples(client)}`;
}
