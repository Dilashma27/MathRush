// MathRush Question Bank
// At least 20 unique questions per level (only 10 correct answers needed to complete a level)

const questions = {
  1: [
    {
      text: "8 + 5 = ?",
      options: ["12", "13", "14"],
      correct: 1
    },
    {
      text: "14 - 6 = ?",
      options: ["7", "8", "9"],
      correct: 1
    },
    {
      text: "3 * 5 = ?",
      options: ["15", "12", "18"],
      correct: 0
    },
    {
      text: "12 + 7 = ?",
      options: ["18", "19", "20"],
      correct: 1
    },
    {
      text: "17 - 9 = ?",
      options: ["6", "7", "8"],
      correct: 2
    },
    {
      text: "4 * 3 = ?",
      options: ["12", "14", "16"],
      correct: 0
    },
    {
      text: "9 + 8 = ?",
      options: ["16", "17", "18"],
      correct: 1
    },
    {
      text: "15 - 8 = ?",
      options: ["6", "7", "8"],
      correct: 1
    },
    {
      text: "2 * 9 = ?",
      options: ["16", "18", "20"],
      correct: 1
    },
    {
      text: "11 + 6 = ?",
      options: ["17", "18", "19"],
      correct: 0
    },
    {
      text: "13 - 7 = ?",
      options: ["5", "6", "7"],
      correct: 1
    },
    {
      text: "5 * 4 = ?",
      options: ["20", "18", "22"],
      correct: 0
    },
    {
      text: "6 + 9 = ?",
      options: ["14", "15", "16"],
      correct: 1
    },
    {
      text: "18 - 11 = ?",
      options: ["6", "7", "8"],
      correct: 1
    },
    {
      text: "3 * 6 = ?",
      options: ["18", "15", "21"],
      correct: 0
    },
    {
      text: "7 + 8 = ?",
      options: ["14", "15", "16"],
      correct: 1
    },
    {
      text: "16 - 9 = ?",
      options: ["6", "7", "8"],
      correct: 1
    },
    {
      text: "5 * 2 = ?",
      options: ["8", "10", "12"],
      correct: 1
    },
    {
      text: "12 + 4 = ?",
      options: ["15", "16", "17"],
      correct: 1
    },
    {
      text: "20 - 7 = ?",
      options: ["12", "13", "14"],
      correct: 1
    }
  ],
  2: [
    {
      text: "12 * 4 = ?",
      options: ["46", "48", "52"],
      correct: 1
    },
    {
      text: "54 / 6 = ?",
      options: ["8", "9", "10"],
      correct: 1
    },
    {
      text: "What is 1/2 of 36?",
      options: ["16", "18", "20"],
      correct: 1
    },
    {
      text: "15 * 3 = ?",
      options: ["40", "45", "50"],
      correct: 1
    },
    {
      text: "64 / 8 = ?",
      options: ["7", "8", "9"],
      correct: 1
    },
    {
      text: "What is 1/3 of 45?",
      options: ["12", "15", "18"],
      correct: 1
    },
    {
      text: "14 * 5 = ?",
      options: ["60", "70", "80"],
      correct: 1
    },
    {
      text: "72 / 9 = ?",
      options: ["8", "9", "12"],
      correct: 0
    },
    {
      text: "What is 2/3 of 24?",
      options: ["14", "16", "18"],
      correct: 1
    },
    {
      text: "16 * 3 = ?",
      options: ["42", "48", "54"],
      correct: 1
    },
    {
      text: "48 / 4 = ?",
      options: ["12", "14", "16"],
      correct: 0
    },
    {
      text: "What is 3/4 of 40?",
      options: ["25", "30", "35"],
      correct: 1
    },
    {
      text: "13 * 4 = ?",
      options: ["48", "52", "56"],
      correct: 1
    },
    {
      text: "96 / 8 = ?",
      options: ["11", "12", "13"],
      correct: 1
    },
    {
      text: "What is 1/4 of 60?",
      options: ["12", "15", "18"],
      correct: 1
    },
    {
      text: "18 * 2 = ?",
      options: ["32", "36", "40"],
      correct: 1
    },
    {
      text: "84 / 7 = ?",
      options: ["11", "12", "13"],
      correct: 1
    },
    {
      text: "What is 2/5 of 50?",
      options: ["15", "20", "25"],
      correct: 1
    },
    {
      text: "15 * 5 = ?",
      options: ["70", "75", "80"],
      correct: 1
    },
    {
      text: "110 / 10 = ?",
      options: ["10", "11", "12"],
      correct: 1
    }
  ],
  3: [
    {
      text: "What is 20% of 150?",
      options: ["25", "30", "35"],
      correct: 1
    },
    {
      text: "Solve for x: 3x - 5 = 16",
      options: ["6", "7", "8"],
      correct: 1
    },
    {
      text: "A train goes 60 mph. How far in 2.5 hours?",
      options: ["120 miles", "150 miles", "180 miles"],
      correct: 1
    },
    {
      text: "What is 15% of 80?",
      options: ["10", "12", "14"],
      correct: 1
    },
    {
      text: "Solve for x: 2x + 8 = 20",
      options: ["5", "6", "7"],
      correct: 1
    },
    {
      text: "If 3 apples cost $1.50, what do 6 apples cost?",
      options: ["$2.50", "$3.00", "$3.50"],
      correct: 1
    },
    {
      text: "What is 25% of 120?",
      options: ["25", "30", "35"],
      correct: 1
    },
    {
      text: "Solve for x: 4x / 2 = 10",
      options: ["4", "5", "6"],
      correct: 1
    },
    {
      text: "A book is 10% off of $50. What is the price?",
      options: ["$40", "$45", "$48"],
      correct: 1
    },
    {
      text: "What is 50% of 250?",
      options: ["100", "125", "150"],
      correct: 1
    },
    {
      text: "Solve for x: 5x + 3 = 28",
      options: ["4", "5", "6"],
      correct: 1
    },
    {
      text: "A car drives 120 mi in 2h. What is average speed?",
      options: ["50 mph", "60 mph", "70 mph"],
      correct: 1
    },
    {
      text: "What is 5% of 400?",
      options: ["15", "20", "25"],
      correct: 1
    },
    {
      text: "Solve for x: 10 - 2x = 4",
      options: ["2", "3", "4"],
      correct: 1
    },
    {
      text: "If you roll a 6-sided die, odds of an even are?",
      options: ["1/3", "1/2", "2/3"],
      correct: 1
    },
    {
      text: "What is 30% of 90?",
      options: ["24", "27", "30"],
      correct: 1
    },
    {
      text: "Solve for x: x/3 + 4 = 10",
      options: ["15", "18", "21"],
      correct: 1
    },
    {
      text: "5 red bags, 3 blue bags. What fraction are red?",
      options: ["3/8", "5/8", "1/2"],
      correct: 1
    },
    {
      text: "Solve for x: 2(x - 3) = 14",
      options: ["9", "10", "11"],
      correct: 1
    },
    {
      text: "A runner goes 400m in 80s. What is speed in m/s?",
      options: ["4 m/s", "5 m/s", "6 m/s"],
      correct: 1
    }
  ]
};

// Make it accessible in browser or via window
window.MathRushQuestions = questions;
