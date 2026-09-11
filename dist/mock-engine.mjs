import {rawScore, number, logistic} from './engine.mjs';

export function convertMock(model, value, {roundPercentage = true, internal = ''} = {}) {
  if (!model?.enabled || !model.parameters) throw Error('This subject needs more data before a conversion can be used.');
  const mockPercentage = rawScore(value, 'Mock percentage');
  const estimatedPercentage = logistic(mockPercentage, model.parameters);
  const usedPercentage = roundPercentage ? Math.round(estimatedPercentage) : estimatedPercentage;
  const externalMark = usedPercentage * model.externalMaximum / 100;
  const internalMaximum = 100 - model.externalMaximum;
  let total = null;
  if (internal !== '' && internal != null) {
    const mark = number(internal, 'Internal assessment total');
    if (mark < 0 || mark > internalMaximum) throw Error(`Internal assessment total must be between 0 and ${internalMaximum}.`);
    total = mark + externalMark;
  }
  return {mockPercentage, estimatedPercentage, usedPercentage, externalMark, total,
    extrapolated: mockPercentage < model.mockRange[0] || mockPercentage > model.mockRange[1]};
}
