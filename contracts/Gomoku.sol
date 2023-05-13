// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "hardhat/console.sol";

contract Gomoku {
    struct Placement {
        uint x;
        uint y;
        string player;
    }

    mapping(uint => Placement[]) userPlacementsMapping;

    function initGame(uint userId) public {
        delete userPlacementsMapping[userId];
    }

    function recordPlacement(uint userId, uint x, uint y, string memory player) public {
        Placement[] storage placements = userPlacementsMapping[userId];
        placements.push(Placement(x, y, player));
    }
}