let computerBoard;

document.addEventListener("DOMContentLoaded", () => {
    const container = document.querySelector(".container");
    const startButton = document.querySelector(".play-button");
    const menuView = document.getElementById("menu-view");
    const gameView = document.getElementById("game-view");
    const gameBoardsView = document.getElementById("game-boards-view");
    const playerBoardContainer = document.getElementById("player-board-container");
    const computerBoardContainer = document.getElementById("computer-board-container");

    const rows = 10;
    const columns = 10;
    const totalShipCount = 10;
    let isHorizontal = true;
    let currentlyDraggingShip = null;
    let isDragging = false;
    let initialPosition = { parent: null, left: 0, top: 0 };
    let deployedShipsCount = 0;
    let currentTurn = 'player';

    const playerShips = {};
    const computerShips = {};

    let computerTargets = [];
    let lastComputerHits = [];

    class Ships {
        constructor(name, color, size) {
            if (!Array.isArray(size)) {
                throw new Error("Size must be an array.");
            }
            this.name = name;
            this.color = color;
            this.size = size;
        }
    }

    const frigate = new Ships("Frigate", "lightgray", [0, 1, 2, 3]);
    const destroyer = new Ships("Destroyer", "lightgray", [0, 1, 2]);
    const cruiser = new Ships("Cruiser", "lightgray", [0, 1]);
    const submarine = new Ships("Submarine", "lightgray", [0]);

    function showGameBoards() {
        gameView.style.display = 'none';
        gameBoardsView.style.display = 'flex';

        playerBoardContainer.appendChild(playerBoard[0][0].parentElement);

        computerBoard = createBoard(computerBoardContainer, rows, columns);
        placeComputerShips();
        addPlayerMoveListeners(computerBoard);
    }

    function moveShipWithCursor(shipElement, x, y) {
        shipElement.style.position = 'absolute';
        shipElement.style.zIndex = '1000';
        shipElement.style.left = `${x - shipElement.offsetWidth / 2}px`;
        shipElement.style.top = `${y - shipElement.offsetHeight / 2}px`;
    }

    function startGame() {
        if (startButton) {
            startButton.addEventListener("click", () => {
                menuView.style.display = 'none';
                gameView.style.display = 'flex';
            });
        } else {
            console.error("Start button not found!");
        }
    }

    function createBoard(gameBoardsContainer, rows, columns) {
        const gameBoard = document.createElement('div');
        gameBoard.classList.add('game-board');
        gameBoardsContainer.append(gameBoard);
        gameBoard.style.display = 'grid';
        gameBoard.style.gridTemplateRows = `repeat(${rows}, 50px)`;
        gameBoard.style.gridTemplateColumns = `repeat(${columns}, 50px)`;

        const boardArray = [];

        for (let row = 0; row < rows; row++) {
            const rowArray = [];
            for (let col = 0; col < columns; col++) {
                let cell = document.createElement('div');
                cell.classList.add('cell');
                cell.style.border = '1px solid black';
                cell.style.backgroundColor = 'lightslategray';

                cell.dataset.row = row;
                cell.dataset.col = col;

                gameBoard.append(cell);
                rowArray.push(cell);
            }
            boardArray.push(rowArray);
        }

        return boardArray;
    }

    function canPlaceShip(row, col, shipLength, boardArray, isHorizontal = true) {
        const directions = [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ];

        if (isHorizontal) {
            for (let i = 0; i < shipLength; i++) {
                if (col + i >= columns || !isCellEmpty(row, col + i, boardArray)) return false;
                for (const [dx, dy] of directions) {
                    const newRow = row + dx;
                    const newCol = col + i + dy;
                    if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < columns) {
                        if (!isCellEmpty(newRow, newCol, boardArray)) return false;
                    }
                }
            }
        } else {
            for (let i = 0; i < shipLength; i++) {
                if (row + i >= rows || !isCellEmpty(row + i, col, boardArray)) return false;
                for (const [dx, dy] of directions) {
                    const newRow = row + i + dx;
                    const newCol = col + dy;
                    if (newRow >= 0 && newRow < rows && newCol >= 0 && newCol < columns) {
                        if (!isCellEmpty(newRow, newCol, boardArray)) return false;
                    }
                }
            }
        }
        return true;
    }

    function isCellEmpty(row, col, boardArray) {
        if (row < 0 || col < 0 || row >= rows || col >= columns) {
            return false;
        }
        const cell = boardArray[row][col];
        return !cell.classList.contains('occupied');
    }

    function placeShipOnBoard(row, col, shipLength, boardArray, shipElement, isHorizontal = true, shipId) {
        if (!shipElement) {
            console.error("shipElement is undefined");
            return;
        }

        const shipCells = [];

        if (isHorizontal) {
            for (let i = 0; i < shipLength; i++) {
                const cell = boardArray[row][col + i];
                cell.classList.add('occupied');
                cell.style.backgroundColor = shipElement.style.backgroundColor;
                cell.dataset.shipId = shipId;
                shipCells.push(cell);
            }
        } else {
            for (let i = 0; i < shipLength; i++) {
                const cell = boardArray[row + i][col];
                cell.classList.add('occupied');
                cell.style.backgroundColor = shipElement.style.backgroundColor;
                cell.dataset.shipId = shipId;
                shipCells.push(cell);
            }
        }

        playerShips[shipId] = {
            cells: shipCells,
            hits: 0,
            size: shipLength
        };

        shipElement.remove();
        onShipPlaced();
    }

    function placeComputerShipOnBoard(row, col, shipLength, boardArray, ship, isHorizontal = true, shipId) {
        const shipCells = [];

        if (isHorizontal) {
            for (let i = 0; i < shipLength; i++) {
                const cell = boardArray[row][col + i];
                cell.classList.add('occupied');
                cell.dataset.shipId = shipId;
                shipCells.push(cell);
            }
        } else {
            for (let i = 0; i < shipLength; i++) {
                const cell = boardArray[row + i][col];
                cell.classList.add('occupied');
                cell.dataset.shipId = shipId;
                shipCells.push(cell);
            }
        }

        computerShips[shipId] = {
            cells: shipCells,
            hits: 0,
            size: shipLength
        };
    }

    document.addEventListener('mouseup', (event) => {
        if (currentlyDraggingShip) {
            snapToGrid(currentlyDraggingShip, event.pageX, event.pageY, playerBoard);
            currentlyDraggingShip = null;
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
        }
    });

    function snapToGrid(shipElement, mouseX, mouseY, boardArray) {
        if (!shipElement) {
            console.error("shipElement is undefined");
            return;
        }

        const boardRect = boardArray[0][0].parentElement.getBoundingClientRect();
        const cellSize = boardArray[0][0].offsetWidth;

        const relativeX = mouseX - boardRect.left;
        const relativeY = mouseY - boardRect.top;
        const row = Math.floor(relativeY / cellSize);
        const col = Math.floor(relativeX / cellSize);

        const shipLength = parseInt(shipElement.dataset.length);
        const shipId = shipElement.dataset.id;

        if (isHorizontal) {
            if (col + shipLength > columns || !canPlaceShip(row, col, shipLength, boardArray, isHorizontal)) {
                resetShipToMenu(shipElement);
                return;
            }
        } else {
            if (row + shipLength > rows || !canPlaceShip(row, col, shipLength, boardArray, isHorizontal)) {
                resetShipToMenu(shipElement);
                return;
            }
        }

        placeShipOnBoard(row, col, shipLength, boardArray, shipElement, isHorizontal, shipId);
    }

    function rotateShipOnScroll(event) {
        if (currentlyDraggingShip) {
            event.preventDefault();
            isHorizontal = !isHorizontal;
            updateShipVisualRotation(currentlyDraggingShip);
        }
    }

    function updateShipVisualRotation(shipElement) {
        const shipLength = shipElement.dataset.length;
        if (isHorizontal) {
            shipElement.style.gridTemplateColumns = `repeat(${shipLength}, 50px)`;
            shipElement.style.gridTemplateRows = `1fr`;
        } else {
            shipElement.style.gridTemplateColumns = `1fr`;
            shipElement.style.gridTemplateRows = `repeat(${shipLength}, 50px)`;
        }
    }

    function resetShipToMenu(shipElement) {
        isHorizontal = true;
        updateShipVisualRotation(shipElement);

        shipElement.style.position = 'static';
        shipElement.style.left = '';
        shipElement.style.top = '';
        shipElement.style.zIndex = '';

        shipElement.classList.remove('dragging-ship');

        const allShipsContainer = initialPosition.parent;
        allShipsContainer.appendChild(shipElement);

        enableShipDragAgain(shipElement);
    }

    window.addEventListener('wheel', rotateShipOnScroll);

    function shipLogic(ships) {
        const allShipsContainer = document.createElement('div');
        allShipsContainer.classList.add('all-ships-container');
        allShipsContainer.style.display = 'flex';
        allShipsContainer.style.flexDirection = 'column';
        allShipsContainer.style.gap = '10px';

        const shipCounts = {
            4: 1,
            3: 2,
            2: 3,
            1: 4
        };

        ships.forEach((ship, index) => {
            const count = shipCounts[ship.size.length] || 0;
            for (let i = 0; i < count; i++) {
                const shipElement = document.createElement("div");
                shipElement.classList.add('ship');
                shipElement.style.display = 'grid';
                shipElement.style.gridTemplateColumns = `repeat(${ship.size.length}, 50px)`;
                shipElement.style.gridTemplateRows = `1fr`;
                shipElement.style.gap = '0.2px';

                shipElement.dataset.length = ship.size.length;
                shipElement.dataset.id = `${ship.name}-${i}`;

                ship.size.forEach(() => {
                    const shipPart = document.createElement('div');
                    shipPart.style.width = '50px';
                    shipPart.style.height = '50px';
                    shipPart.style.backgroundColor = ship.color;
                    shipPart.style.border = '1px solid black';
                    shipElement.appendChild(shipPart);
                });

                shipElement.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    currentlyDraggingShip = shipElement;
                    shipElement.classList.add('dragging-ship');

                    initialPosition = {
                        parent: shipElement.parentElement,
                        left: shipElement.offsetLeft,
                        top: shipElement.offsetTop
                    };

                    document.addEventListener('mousemove', onMouseMove);
                    window.addEventListener('wheel', rotateShipOnScroll, { passive: false });
                });

                shipElement.addEventListener('mouseup', () => {
                    currentlyDraggingShip = null;
                    isDragging = false;
                    shipElement.classList.remove('dragging-ship');
                    window.removeEventListener('wheel', rotateShipOnScroll, { passive: false });
                    document.removeEventListener('mousemove', onMouseMove);
                });

                allShipsContainer.append(shipElement);
            }
        });

        gameBoardsContainer.append(allShipsContainer);
        gameBoardsContainer.style.display = 'flex';
        gameBoardsContainer.style.flexDirection = 'row-reverse';
    }

    function onShipPlaced() {
        deployedShipsCount++;
        if (deployedShipsCount === totalShipCount) {
            console.log("You finished your deployment!");
            showGameBoards();
        }
    }

    function enableShipDragAgain(shipElement) {
        shipElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            currentlyDraggingShip = shipElement;
            shipElement.classList.add('dragging-ship');

            initialPosition = {
                parent: shipElement.parentElement,
                left: shipElement.offsetLeft,
                top: shipElement.offsetTop
            };

            document.addEventListener('mousemove', onMouseMove);
            window.addEventListener('wheel', rotateShipOnScroll, { passive: false });
        });
    }

    function onMouseMove(event) {
        if (currentlyDraggingShip) {
            moveShipWithCursor(currentlyDraggingShip, event.pageX, event.pageY);
        }
    }

    function addPlayerMoveListeners(boardArray) {
        boardArray.forEach(row => {
            row.forEach(cell => {
                cell.addEventListener('click', () => {
                    if (currentTurn === 'player' && !cell.classList.contains('hit') && !cell.classList.contains('miss')) {
                        if (cell.classList.contains('occupied')) {
                            cell.classList.add('hit');
                            cell.style.backgroundColor = 'red';
                            const shipId = cell.dataset.shipId;
                            computerShips[shipId].hits++;
                            if (computerShips[shipId].hits === computerShips[shipId].size) {
                                markShipAsSunk(computerShips[shipId]);
                                alert(`You sunk the computer's ${shipId}!`);
                            }
                            if (checkAllShipsSunk(computerShips)) {
                                alert('Congratulations! You won!');
                                if (confirm('Do you want to play again?')) {
                                    location.reload();
                                }
                            }
                        } else {
                            cell.classList.add('miss');
                            cell.style.backgroundColor = 'white';
                        }
                        switchTurn();
                    }
                });
            });
        });
    }

    function computerMove() {
        let cell;

        if (computerTargets.length > 0) {
            const [row, col] = computerTargets.shift();
            cell = playerBoard[row][col];
            if (cell.classList.contains('hit') || cell.classList.contains('miss')) {
                setTimeout(computerMove, 0);
                return;
            }
        } else {
            let row, col;
            do {
                row = Math.floor(Math.random() * rows);
                col = Math.floor(Math.random() * columns);
                cell = playerBoard[row][col];
            } while (cell.classList.contains('hit') || cell.classList.contains('miss'));
        }

        console.log(`Computer shot at: row ${cell.dataset.row}, col ${cell.dataset.col}`);

        if (cell.classList.contains('occupied')) {
            cell.classList.add('hit');
            cell.style.backgroundColor = 'red';
            const shipId = cell.dataset.shipId;
            playerShips[shipId].hits++;
            if (playerShips[shipId].hits === playerShips[shipId].size) {
                markShipAsSunk(playerShips[shipId]);
                alert(`Your ${shipId} has been sunk!`);
                computerTargets = [];
            } else {
                addAdjacentCellsToTargets(parseInt(cell.dataset.row), parseInt(cell.dataset.col));
            }
            if (checkAllShipsSunk(playerShips)) {
                alert('Sorry, you lost!');
                if (confirm('Do you want to play again?')) {
                    location.reload();
                }
            } else {
                setTimeout(computerMove, 1000);
                return;
            }
        } else {
            cell.classList.add('miss');
            cell.style.backgroundColor = 'white';
        }
        switchTurn();
    }


    function addAdjacentCellsToTargets(row, col) {
        const potentialTargets = [
            [row - 1, col],
            [row + 1, col],
            [row, col - 1],
            [row, col + 1]
        ];

        potentialTargets.forEach(([r, c]) => {
            if (r >= 0 && r < rows && c >= 0 && c < columns) {
                const cell = playerBoard[r][c];
                if (!cell.classList.contains('hit') && !cell.classList.contains('miss') && !cell.dataset.targeted) {
                    cell.dataset.targeted = true;
                    computerTargets.push([r, c]);
                }
            }
        });
    }

    function switchTurn() {
        if (currentTurn === 'player') {
            currentTurn = 'computer';
            setTimeout(computerMove, 1000);
        } else {
            currentTurn = 'player';
        }
    }

    function placeComputerShips() {
        const ships = [frigate, destroyer, cruiser, submarine];
        ships.forEach(ship => {
            const count = getShipCount(ship.size.length);
            for (let i = 0; i < count; i++) {
                let placed = false;
                while (!placed) {
                    const isHorizontal = Math.random() < 0.5;
                    const row = Math.floor(Math.random() * rows);
                    const col = Math.floor(Math.random() * columns);
                    const shipId = `${ship.name}-${i}`;
                    if (canPlaceShip(row, col, ship.size.length, computerBoard, isHorizontal)) {
                        placeComputerShipOnBoard(row, col, ship.size.length, computerBoard, ship, isHorizontal, shipId);
                        placed = true;
                    }
                }
            }
        });
    }

    function getShipCount(shipLength) {
        const shipCounts = {
            4: 1,
            3: 2,
            2: 3,
            1: 4
        };
        return shipCounts[shipLength] || 0;
    }

    function checkAllShipsSunk(shipsMap) {
        for (const shipId in shipsMap) {
            if (shipsMap[shipId].hits < shipsMap[shipId].size) {
                return false;
            }
        }
        return true;
    }

    function markShipAsSunk(ship) {
        ship.cells.forEach(cell => {
            cell.style.backgroundColor = 'darkred';
        });
    }

    gameView.style.display = 'none';

    const gameBoardsContainer = document.createElement("div");
    gameBoardsContainer.classList.add("game-board-container");
    gameView.append(gameBoardsContainer);

    startGame();

    const playerBoard = createBoard(gameBoardsContainer, rows, columns);

    const ships = [frigate, destroyer, cruiser, submarine];

    shipLogic(ships);
});
