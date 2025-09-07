// Swipe handling
let touchStartX = 0;
let touchEndX = 0;

const area = document.getElementById("calendarArea");

area.addEventListener("touchstart", e => {
  touchStartX = e.changedTouches[0].screenX;
}, false);

area.addEventListener("touchend", e => {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}, false);

function handleSwipe() {
  let diff = touchEndX - touchStartX;
  if (Math.abs(diff) < 50) return; // ignore small moves
  if (diff > 0) {
    // swipe right → prev
    prev();
  } else {
    // swipe left → next
    next();
  }
}

function prev() {
  if(currentView==="day") currentDate.setDate(currentDate.getDate()-1);
  else if(currentView==="week") currentDate.setDate(currentDate.getDate()-7);
  else if(currentView==="month") currentDate.setMonth(currentDate.getMonth()-1);
  else if(currentView==="year") currentDate.setFullYear(currentDate.getFullYear()-1);
  render();
}

function next() {
  if(currentView==="day") currentDate.setDate(currentDate.getDate()+1);
  else if(currentView==="week") currentDate.setDate(currentDate.getDate()+7);
  else if(currentView==="month") currentDate.setMonth(currentDate.getMonth()+1);
  else if(currentView==="year") currentDate.setFullYear(currentDate.getFullYear()+1);
  render();
}

// Update button events to use new helpers
$("prevBtn").onclick = prev;
$("nextBtn").onclick = next;
