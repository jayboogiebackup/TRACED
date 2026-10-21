// Vector app icons for GH0ST//OS. drawIcon(ctx, id, centreX, centreY, size, time)

const ACCENT = {
  miner: '#ffc857',
  rigmart: '#6ab7ff',
  casino: '#ff5c5c',
  organs: '#ff7a7a',
  chirp: '#6ab7ff',
  arcade: '#b48cff',
  stonks: '#5cf08a',
  velvet: '#ff7ad9',
  datamart: '#5cf08a',
  safenet: '#5cf08a',
  burner: '#dfe6df',
  scanner: '#ff5c5c',
  terminal: '#5cf08a',
  files: '#ffc857',
  readme: '#dfe6df',
  photo: '#8a9792',
  trash: '#8a9792',
};

export function drawIcon(ctx, id, cx, cy, s, t = 0) {
  const a = ACCENT[id] || '#dfe6df';
  ctx.save();
  ctx.translate(cx, cy);
  const k = s / 64;
  ctx.scale(k, k);
  // tile
  ctx.beginPath();
  ctx.roundRect(-30, -30, 60, 60, 12);
  ctx.fillStyle = '#151b1d';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = a;
  ctx.globalAlpha = 0.55;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = a;
  ctx.fillStyle = a;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const P = new Path2D();
  switch (id) {
    case 'miner': {
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'bold 26px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('₿', 0, 1);
      break;
    }
    case 'rigmart': {
      ctx.strokeRect(-22, -12, 44, 24);
      ctx.beginPath();
      ctx.arc(-9, 0, 7, 0, Math.PI * 2);
      ctx.moveTo(16, 0);
      ctx.arc(9, 0, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillRect(-18, 13, 14, 4);
      break;
    }
    case 'casino': {
      ctx.strokeRect(-22, -18, 44, 36);
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('777', 0, 1);
      break;
    }
    case 'organs': {
      // kidney
      ctx.beginPath();
      ctx.moveTo(4, -20);
      ctx.bezierCurveTo(-26, -24, -26, 24, 4, 20);
      ctx.bezierCurveTo(16, 18, 18, 8, 8, 4);
      ctx.bezierCurveTo(2, 1, 2, -1, 8, -4);
      ctx.bezierCurveTo(18, -8, 16, -18, 4, -20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
      break;
    }
    case 'chirp': {
      ctx.beginPath();
      ctx.moveTo(-18, 6);
      ctx.quadraticCurveTo(-14, -16, 6, -12);
      ctx.quadraticCurveTo(14, -18, 20, -12);
      ctx.lineTo(14, -6);
      ctx.quadraticCurveTo(14, 16, -10, 14);
      ctx.quadraticCurveTo(-16, 12, -18, 6);
      ctx.fill();
      ctx.fillStyle = '#151b1d';
      ctx.beginPath();
      ctx.arc(8, -9, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arcade': {
      ctx.strokeRect(-20, 4, 40, 14);
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(-6, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-6, -15, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10, 10, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'stonks': {
      ctx.beginPath();
      ctx.moveTo(-20, 16);
      ctx.lineTo(-8, 2);
      ctx.lineTo(2, 8);
      ctx.lineTo(18, -14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, -15);
      ctx.lineTo(19, -15);
      ctx.lineTo(19, -4);
      ctx.stroke();
      break;
    }
    case 'velvet': {
      ctx.save();
      ctx.rotate(-0.7);
      ctx.beginPath();
      ctx.roundRect(-20, -9, 40, 18, 9);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-20, -9, 20, 18, [9, 0, 0, 9]);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'datamart': {
      ctx.beginPath();
      ctx.ellipse(0, -14, 18, 6, 0, 0, Math.PI * 2);
      ctx.moveTo(-18, -14);
      ctx.lineTo(-18, 14);
      ctx.ellipse(0, 14, 18, 6, 0, Math.PI, 0, true);
      ctx.lineTo(18, -14);
      ctx.moveTo(-18, 0);
      ctx.ellipse(0, 0, 18, 6, 0, Math.PI, 0, true);
      ctx.stroke();
      break;
    }
    case 'safenet': {
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(18, -14);
      ctx.quadraticCurveTo(18, 12, 0, 22);
      ctx.quadraticCurveTo(-18, 12, -18, -14);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-2, 7);
      ctx.lineTo(9, -7);
      ctx.stroke();
      break;
    }
    case 'burner': {
      ctx.beginPath();
      ctx.roundRect(-20, -17, 40, 28, 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, 11);
      ctx.lineTo(-14, 20);
      ctx.lineTo(2, 11);
      ctx.stroke();
      for (const x of [-9, 0, 9]) {
        ctx.beginPath();
        ctx.arc(x, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'scanner': {
      ctx.strokeRect(-14, -6, 28, 26);
      ctx.beginPath();
      ctx.moveTo(8, -6);
      ctx.lineTo(14, -22);
      ctx.stroke();
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.beginPath();
      ctx.arc(-4, 7, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'terminal': {
      ctx.beginPath();
      ctx.moveTo(-18, -10);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-18, 10);
      ctx.stroke();
      if (Math.floor(t * 2) % 2 === 0) ctx.fillRect(0, 8, 18, 4);
      break;
    }
    case 'files': {
      ctx.beginPath();
      ctx.moveTo(-22, -14);
      ctx.lineTo(-8, -14);
      ctx.lineTo(-4, -9);
      ctx.lineTo(22, -9);
      ctx.lineTo(22, 16);
      ctx.lineTo(-22, 16);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'readme': {
      ctx.strokeRect(-15, -20, 30, 40);
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-9, -10 + i * 8);
        ctx.lineTo(9 - (i === 3 ? 8 : 0), -10 + i * 8);
        ctx.stroke();
      }
      break;
    }
    case 'photo': {
      ctx.strokeRect(-20, -15, 40, 30);
      ctx.beginPath();
      ctx.moveTo(-16, 11);
      ctx.lineTo(-4, -2);
      ctx.lineTo(4, 6);
      ctx.lineTo(10, 0);
      ctx.lineTo(17, 11);
      ctx.stroke();
      break;
    }
    case 'trash': {
      ctx.beginPath();
      ctx.moveTo(-14, -12);
      ctx.lineTo(-11, 20);
      ctx.lineTo(11, 20);
      ctx.lineTo(14, -12);
      ctx.moveTo(-18, -12);
      ctx.lineTo(18, -12);
      ctx.moveTo(-5, -17);
      ctx.lineTo(5, -17);
      ctx.stroke();
      break;
    }
    default: {
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
