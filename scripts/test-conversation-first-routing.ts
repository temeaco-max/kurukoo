import { routeIntent } from '../src/services/intentRouter.js';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main() {
  const exploratory = await routeIntent("I'm thinking about getting a cleaner this weekend.");
  assert(exploratory.skill === 'general_question', `Expected exploration to stay conversational, got ${exploratory.skill}`);

  const explicit = await routeIntent('Please find me a cleaner in Ibadan this weekend.');
  assert(explicit.skill === 'find_worker', `Expected explicit action to route to find_worker, got ${explicit.skill}`);

  const problem = await routeIntent("My phone has been acting weird since yesterday.");
  assert(problem.skill === 'general_question', `Expected an unresolved phone problem to remain conversational, got ${problem.skill}`);

  const howQuestion = await routeIntent('How can I get a cleaner for Saturday?');
  assert(howQuestion.skill === 'general_question', `Expected exploratory how-question to remain conversational, got ${howQuestion.skill}`);

  const safetyCheckIn = await routeIntent('Set a safety check-in');
  assert(safetyCheckIn.skill === 'safety_contact', `Expected explicit safety check-in to route to safety contact flow, got ${safetyCheckIn.skill}`);
  assert(/sign in/i.test(safetyCheckIn.reply), 'Unsigned safety check-in should state the profile-bound sign-in prerequisite rather than fall through to generic chat');

  console.log('Conversation-first routing regression passed, including the explicit safety check-in prerequisite.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
