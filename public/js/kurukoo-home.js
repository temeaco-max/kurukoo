(() => {
  const demo = document.querySelector('[data-storefront-demo]');
  if (!demo) return;

  const scenarios = {
    food: {
      user: 'Help me find dinner nearby.',
      assistant: 'I’ll capture what you need, then show an option only when availability and pricing are confirmed.',
      category: 'Food & drink',
      title: 'Request details first',
      detail: 'Choose what you want and where you need it. No provider is selected yet.',
      price: 'Price on request',
      state: 'Awaiting details',
      prompt: 'Help me find food nearby',
    },
    repair: {
      user: 'My washing machine needs repair.',
      assistant: 'I’ll collect the fault and location before Kurukoo considers eligible repair options.',
      category: 'Repairs & maintenance',
      title: 'Describe the repair',
      detail: 'A diagnosis, location and urgency are needed before any provider or quote is presented.',
      price: 'Quote not yet available',
      state: 'Awaiting details',
      prompt: 'I need help repairing my washing machine',
    },
    ride: {
      user: 'I need to get to the airport tomorrow.',
      assistant: 'I’ll collect the route and timing. Availability is checked before a ride option is shown.',
      category: 'Transport & mobility',
      title: 'Plan the journey',
      detail: 'Origin, destination and departure time are still needed. No driver is assigned.',
      price: 'Fare to be confirmed',
      state: 'Awaiting route details',
      prompt: 'I need a ride to the airport tomorrow',
    },
  };

  const text = (selector, value) => { const target = demo.querySelector(selector); if (target) target.textContent = value; };
  const applyScenario = (name) => {
    const scenario = scenarios[name] || scenarios.food;
    text('[data-demo-user]', scenario.user);
    text('[data-demo-assistant]', scenario.assistant);
    text('[data-demo-category]', scenario.category);
    text('[data-demo-title]', scenario.title);
    text('[data-demo-detail]', scenario.detail);
    text('[data-demo-price]', scenario.price);
    text('[data-demo-state]', scenario.state);
    const action = demo.querySelector('[data-demo-action]');
    if (action) action.dataset.prompt = scenario.prompt;
    demo.querySelectorAll('[data-storefront-scenario]').forEach((button) => button.classList.toggle('is-active', button.dataset.storefrontScenario === name));
  };

  demo.querySelectorAll('[data-storefront-scenario]').forEach((button) => button.addEventListener('click', () => applyScenario(button.dataset.storefrontScenario)));
  demo.querySelector('[data-demo-action]')?.addEventListener('click', () => {
    const prompt = demo.querySelector('[data-demo-action]')?.dataset.prompt || scenarios.food.prompt;
    window.location.assign(`/chat?prompt=${encodeURIComponent(prompt)}`);
  });
  applyScenario('food');
})();
