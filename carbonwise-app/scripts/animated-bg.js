// Animated Background for Hero Section
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('animated-bg');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  
  // Resize canvas on window resize
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });
  
  // Line graph animation
  const points = [];
  const numPoints = 50;
  
  // Initialize points
  for (let i = 0; i < numPoints; i++) {
    points.push({
      x: (width / numPoints) * i,
      y: height / 2 + Math.sin(i * 0.2) * 50,
      vy: (Math.random() - 0.5) * 0.5
    });
  }
  
  function animate() {
    ctx.clearRect(0, 0, width, height);
    
    // Update and draw points
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 200, 83, 0.3)';
    ctx.lineWidth = 2;
    
    points.forEach((point, i) => {
      // Update y position
      point.y += point.vy;
      
      // Bounce off edges
      if (point.y < height * 0.3 || point.y > height * 0.7) {
        point.vy *= -1;
      }
      
      // Draw line
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    
    ctx.stroke();
    
    // Draw glow effect
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0, 200, 83, 0.5)';
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    requestAnimationFrame(animate);
  }
  
  animate();
});
