function supportsPortraitTextTransform(context) {
  return ["save", "translate", "rotate", "restore"].every((method) => typeof context?.[method] === "function");
}

export function drawWorldText(context, label, x, y, portrait = false) {
  if (typeof context?.fillText !== "function") return;
  if (!portrait || !supportsPortraitTextTransform(context)) {
    context.fillText(label, x, y);
    return;
  }
  context.save();
  context.translate(x, y);
  context.rotate(-Math.PI / 2);
  context.fillText(label, 0, 0);
  context.restore();
}
