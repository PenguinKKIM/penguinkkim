// 3D 모델과 별도로 실행하므로 모델을 불러오지 못해도 그림 목록은 동작합니다.
const drawingReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll(".drawing-gallery").forEach((gallery) => {
  if (!Element.prototype.animate) return;

  const items = Array.from(gallery.querySelectorAll(".drawing-item")).map((details) => ({
    details,
    summary: details.querySelector(".drawing-summary"),
    content: details.querySelector(".drawing-content"),
    list: details.querySelector(".drawing-list"),
    expanded: details.open,
    animation: null,
  }));

  function finishAnimation(item) {
    item.details.open = item.expanded;
    if (item.animation) {
      item.animation.onfinish = null;
      item.animation.cancel();
      item.animation = null;
    }
  }

  function setExpanded(item, expanded) {
    if (item.expanded === expanded) return;

    const startHeight = item.details.open ? item.content.getBoundingClientRect().height : 0;
    const startOpacity = item.details.open ? getComputedStyle(item.content).opacity : 0;

    if (item.animation) {
      item.animation.onfinish = null;
      item.animation.cancel();
      item.animation = null;
    }

    item.expanded = expanded;

    if (drawingReducedMotion.matches) {
      finishAnimation(item);
      return;
    }

    item.details.open = true;
    const endHeight = expanded ? item.list.getBoundingClientRect().height : 0;

    item.animation = item.content.animate(
      [
        { height: `${startHeight}px`, opacity: startOpacity },
        { height: `${endHeight}px`, opacity: expanded ? 1 : 0 },
      ],
      {
        duration: 400,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
        fill: "both",
      },
    );

    item.animation.onfinish = () => finishAnimation(item);
  }

  items.forEach((item) => {
    item.details.removeAttribute("name");

    item.summary.addEventListener("click", (event) => {
      event.preventDefault();
      const expanded = !item.expanded;

      if (expanded) {
        items.forEach((other) => {
          if (other !== item) setExpanded(other, false);
        });
      }

      setExpanded(item, expanded);
    });
  });

  window.addEventListener("resize", () => {
    items.forEach(finishAnimation);
  });

  drawingReducedMotion.addEventListener("change", () => {
    items.forEach(finishAnimation);
  });
});
