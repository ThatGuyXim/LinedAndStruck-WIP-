import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Dimensions, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Canvas, Rect, Group } from '@shopify/react-native-skia';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.45; // Fixed height layout tracking top half boundary
const HALF_HEIGHT = CANVAS_WIDTH / 2; // Fixed projection mapping aspect balance ratio

// --- Comprehensive Map Matrix Configuration ---
// 0 = Walkable Air, 1 = Blue Stripe, 2 = Orange Stripe, 3 = Green Horizon Field, 4 = Barricaded Bulkhead Exit
const ESCAPE_MAP = [
  1, 2, 1, 2, 1, 2, 1, 2,
  2, 0, 0, 0, 0, 0, 0, 1,
  1, 0, 0, 0, 0, 0, 0, 2,
  2, 0, 0, 0, 0, 0, 0, 4, // Eastern locked titanium door coordinate panel row
  1, 0, 0, 0, 0, 0, 0, 2,
  2, 0, 0, 0, 0, 0, 0, 1,
  1, 2, 1, 2, 1, 2, 1, 2,
  3, 3, 3, 3, 3, 3, 3, 3  
];
const MAP_SIZE = 8;

// --- Hoisted Styles Sheet Optimization Matrix ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topViewport: {
    width: SCREEN_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#000000',
  },
  gameCanvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  },
  blackoutCover: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    backgroundColor: '#000000',
  },
  bottomInterfacePanel: {
    flex: 1,
    backgroundColor: '#050508',
    borderTopWidth: 2,
    borderColor: '#151522',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  inventoryContainer: {
    backgroundColor: '#0c0c14',
    borderWidth: 1,
    borderColor: '#1d1d2e',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inventoryTitle: {
    fontFamily: 'Courier New',
    color: '#8c8ca3',
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 8,
  },
  inventoryScroll: {
    alignItems: 'center',
  },
  emptyInventoryText: {
    fontFamily: 'Courier New',
    color: '#44445c',
    fontSize: 11,
  },
  inventoryItemBadge: {
    backgroundColor: '#161626',
    borderWidth: 1,
    borderColor: '#31314d',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  inventoryItemText: {
    fontFamily: 'Courier New',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  dialogueTextScroll: {
    maxHeight: 75,
    marginBottom: 6,
  },
  dialogueText: {
    fontFamily: 'Courier New',
    color: '#cdcdde',
    fontSize: 13,
    lineHeight: 18,
  },
  interactionSection: {
    marginBottom: 8,
  },
  choiceButton: {
    borderWidth: 1,
    borderColor: '#26263b',
    backgroundColor: '#0a0a12',
    padding: 10,
    marginBottom: 5,
    borderRadius: 4,
  },
  choiceButtonDisabled: {
    borderColor: '#161621',
    backgroundColor: '#05050a',
  },
  choiceButtonText: {
    fontFamily: 'Courier New',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  choiceButtonTextDisabled: {
    color: '#444459',
  },
  nameInputField: {
    borderWidth: 1,
    borderColor: '#222233',
    backgroundColor: '#020205',
    color: '#ffffff',
    fontFamily: 'Courier New',
    padding: 8,
    fontSize: 13,
    borderRadius: 4,
    marginBottom: 6,
  },
  turnOverlayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 5,
  },
  turnButton: {
    backgroundColor: '#0e0e17',
    borderWidth: 1,
    borderColor: '#31314d',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    flex: 0.48,
    alignItems: 'center',
  },
  turnButtonText: {
    fontFamily: 'Courier New',
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  creditsContainer: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  creditsText: {
    fontFamily: 'Courier New',
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
  },
});
const STORY_NODES = {
  intro: {
    text: "You awake inside a place you don't quite remember, yet do. The stripes on the walls look strange, and so does the wide open exit with no door. 'Ahh... my head...' you say to yourself expecting a response or something- but alas nothing. What do you do?",
    choices: [
      { text: "Examine the strange stripes", nextNode: "examine_room" },
      { text: "Walk out towards the wide open exit", action: "start_pan", nextNode: "pan_sequence" }
    ]
  },
  examine_room: {
    text: "The blue and orange stripes warp oddly as you stare. Your head throbs. The open exit seems to be the only real path forward.",
    choices: [
      { text: "Walk out towards the wide open exit", action: "start_pan", nextNode: "pan_sequence" }
    ]
  },
  pan_sequence: {
    text: "You step out into a blinding flash. The layout fades, cutting to black, before revealing a beautiful landscape opening wide across the horizon...",
    choices: [
      { text: "Look around the horizon", action: "trigger_meet", nextNode: "meet_faceless" }
    ]
  },
  meet_faceless: {
    text: "An all-black humanoid shape suddenly steps directly into your field of view from the open field. Faceless yet human, it looks at you. 'What is your name?' it asks calmly.",
    input: true, 
    choices: []  
  },
  confrontation: {
    text: (name) => `"${name}... Yes. ${name}." The shadow repeats your words in a cold, hollow tone. "You don't belong out here. You belong in the bunker." It draws a heavy bat, swinging it down hard into your field of view—`,
    choices: [
      { text: "Black out...", action: "knockout", nextNode: "waking_up_locked" }
    ]
  },
  waking_up_locked: {
    text: "A sharp pain pierces your skull as your eyes flutter open. You are back inside the striped chamber. But everything has changed. The wide open exit is gone, completely sealed shut by a massive iron bulkhead security panel. A buzzing emergency tracker light flashes in the corner. You have to escape.",
    choices: [
      { text: "Stand up and inspect your immediate surroundings", action: "stop_pan_on_stand", nextNode: "bunker_hub" }
    ]
  },
  bunker_hub: {
    text: "You are standing in the center of the striped room. The titanium bulkhead door seals the eastern wall tight. To your north sits a corroded mechanical terminal box. To your south is a loose vent grate near the floor. To your west is a locked cabinet frame.",
    choices: [
      { text: "Inspect the Northern Terminal Box", nextNode: "north_terminal" },
      { text: "Examine the Southern Vent Grate", nextNode: "south_vent" },
      { text: "Inspect the Western Cabinet", nextNode: "west_cabinet" },
      { text: "Examine the Eastern Bulkhead Door", nextNode: "east_door" }
    ]
  },
  north_terminal: {
    text: "The mechanical terminal box hums quietly. Its status indicator reads: 'OFFLINE - SYSTEM REQUIREMENT: COPPER CIRCUITS INTEGRITY REPAIR'. A keyhole sits at the bottom edge of the box, keeping the primary circuit panel locked out.",
    choices: [
      { text: "Use Iron Key on Keyhole", requirement: "Iron Key", action: "unlock_terminal", nextNode: "terminal_unlocked" },
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  terminal_unlocked: {
    text: "The keyhole clicks loudly! The metal front panel drops down, revealing a monitor screen displaying flashing code text: 'OVERRIDE MATRIX KEYCODE FOUND. THE COMBINATION CODE IS [ 8 - 4 - 2 ]'. Below the screen lies a burnt circuit board missing its copper wires.",
    choices: [
      { text: "Repair circuitry using Copper Wire", requirement: "Copper Wire", action: "repair_terminal", nextNode: "terminal_active" },
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  terminal_active: {
    text: "The copper lines link up perfectly! The system cycles green. A primary remote notification flashes: 'EASTERN OVERRIDE COMMAND IS GO. SYNCHRONIZATION ACTIVE.'",
    choices: [
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  south_vent: {
    text: "A low stream of cold air sweeps through a heavy vent grate near the baseboard. The steel screws are completely rusted shut, but they look soft enough to pry open if you had a flat steel tool.",
    choices: [
      { text: "Pry open the vent using the Metal Crowbar", requirement: "Metal Crowbar", action: "pry_vent", nextNode: "vent_opened" },
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  vent_opened: {
    text: "You hammer the edge of the crowbar into the seam, popping the rusted grate off completely. Reaching inside the dark ventilation tunnel, your fingers brush against a cold spool of Copper Wire! You pull it out.",
    choices: [
      { text: "Take the Copper Wire", action: "get_wire", nextNode: "vent_empty" },
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  vent_empty: {
    text: "The ventilation duct sits completely open and empty. Nothing else remains inside.",
    choices: [
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  west_cabinet: {
    text: "A reinforced steel storage locker is embedded into the striped wall panels. A digital padlock blocks the handle, requiring a specific 3-digit access pin combo.",
    choices: [
      { text: "Enter Padlock Keycode Combination", action: "trigger_padlock_input", nextNode: "cabinet_padlock_prompt" },
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  cabinet_padlock_prompt: {
    text: "The padlock keypad blinks slowly, waiting for you to input the correct 3-digit terminal override pin combination configuration.",
    inputCode: true,
    choices: [
      { text: "Back away from cabinet", nextNode: "bunker_hub" }
    ]
  },
  cabinet_opened: {
    text: "The electronic latch clicks open! Inside the storage rack compartment sits a heavy, solid industrial Metal Crowbar.",
    choices: [
      { text: "Collect the Metal Crowbar", action: "get_crowbar", nextNode: "cabinet_empty" },
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  cabinet_empty: {
    text: "The locker shelves sit empty. Dust particles float across the bare steel framing.",
    choices: [
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  east_door: {
    text: "The massive titanium bulkhead security frame holds its seal firmly. The automated override matrix box beside the door requires an active terminal connection sync to pop the locking deadbolts open.",
    choices: [
      { text: "Trigger Door Release Command", requirement: "terminalRepaired", action: "escape_victory", nextNode: "chase_scene" },
      { text: "Inspect floor cracks beneath door frame", nextNode: "floor_inspected" },
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  floor_inspected: {
    text: "Kneeling down, you look close at the structural floor panels beneath the bulkhead. Tucked deep inside a drainage groove line sits a rusted Iron Key!",
    choices: [
      { text: "Pick up the Iron Key", action: "get_key", nextNode: "floor_empty" },
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  floor_empty: {
    text: "The expansion floor grooves beneath the bulkhead are empty.",
    choices: [
      { text: "Back to room center", nextNode: "bunker_hub" }
    ]
  },
  chase_scene: {
    text: "The heavy bulkhead door slides upward! You burst out onto the green plate horizon, running as fast as you can. But a fast shadow follows close behind. It's him. The faceless man is sprinting right after you, bat raised, determined to drag you back inside.",
    choices: [
      { text: "Keep running desperately", nextNode: "counter_attack" }
    ]
  },
  counter_attack: {
    text: "The heavy footfalls drag closer. You can hear his breath. Suddenly, you plant your feet into the green field, spin around completely, and throw a devastating punch right into his faceless head! *CRACK!* He drops straight to the grass, completely knocked out.",
    choices: [
      { text: "Drag his unconscious body back to the bunker", nextNode: "revenge_finale" }
    ]
  },
  revenge_finale: {
    text: "You hoist his heavy shape across the threshold, throwing him onto the striped floor panels. You smash the manual safety release lever on the wall. The heavy titanium bulkhead door drops back down with a massive thunderous crash, locking HIM inside the bunker forever. You let out a quiet chuckle, turn around, and leisurely walk away across the beautiful open landscape.",
    choices: [
      { text: "PLAY AGAIN", action: "reset", nextNode: "intro" }
    ]
  }
};
// --- Low-Overhead Pure Grid Raycasting Processor ---
function renderWolf3DView(px, py, angle, contextState) {
  const slices = [];
  const { isLandscape, escapePhase } = contextState;
  
  const numRays = isLandscape ? 180 : 60; 
  const fov = Math.PI / 3; 
  const sw = CANVAS_WIDTH / numRays;
  
  const startAngle = angle - fov / 2;
  
  for (let i = 0; i < numRays; i++) {
    const rayAngle = startAngle + (i * (fov / numRays));
    let d = 0;
    let hit = false;
    let type = 0;
    
    const cos = Math.cos(rayAngle);
    const sin = Math.sin(rayAngle);
    
    while (!hit && d < 12) {
      d += 0.12;
      const tx = Math.floor(px + cos * d);
      const ty = Math.floor(py + sin * d);
      
      if (isLandscape) {
        hit = true;
        type = 3;
        d = 4; 
        break;
      }
      
      if (tx >= 0 && tx < MAP_SIZE && ty >= 0 && ty < MAP_SIZE) {
        const gridVal = ESCAPE_MAP[ty * MAP_SIZE + tx];
        
        if (tx === 7 && ty === 3 && !escapePhase) {
          type = 0; 
        } else if (gridVal > 0) {
          hit = true;
          type = gridVal;
        }
      } else {
        hit = true;
        type = 3;
      }
    }
    
    let correctedD = d * Math.cos(rayAngle - angle);
    if (correctedD < 0.15) correctedD = 0.15;
    
    let wallH = Math.min(CANVAS_HEIGHT, (CANVAS_HEIGHT * 1.5) / correctedD);
    let wallY = (CANVAS_HEIGHT / 2) - wallH / 2;
    const visAlpha = Math.max(0.15, 1.0 - correctedD / 12);
    
    let color = 'rgba(0,0,0,0)';
    if (type === 1) color = `rgba(0, 102, 204, ${visAlpha})`;  
    else if (type === 2) color = `rgba(255, 128, 0, ${visAlpha})`; 
    else if (type === 3) color = `rgba(0, 153, 76, ${visAlpha})`;  
    else if (type === 4) color = `rgba(102, 102, 102, ${visAlpha})`; 
    
    if (isLandscape && i >= 78 && i <= 102) {
      wallH = CANVAS_HEIGHT * 0.85; 
      wallY = (CANVAS_HEIGHT / 2) - wallH / 2;
      color = '#000000'; 
    }
      
    slices.push({ x: i * sw, y: wallY, w: sw + 1, h: wallH, color });
  }
  return slices;
}
export default function App() {
  const [currentNode, setCurrentNode] = useState('intro');
  const [playerName, setPlayerName] = useState('');
  const [pinInput, setPinInput] = useState('');
  
  // Core Position Variables
  const [player, setPlayer] = useState({ x: 3.5, y: 3.5, angle: 0 }); 
  
  // Game Context Flags
  const [isLandscape, setIsLandscape] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [panActive, setPanActive] = useState(false);
  const [escapePhase, setEscapePhase] = useState(false);

  // Puzzle State Architecture Matrix
  const [inventory, setInventory] = useState([]);
  const [gameStateFlags, setGameStateFlags] = useState({
    floorSearched: false,
    cabinetUnlocked: false,
    ventOpened: false,
    terminalUnlocked: false,
    terminalRepaired: false
  });

  // Automatic panoramic loop camera pan tracker hook
  useEffect(() => {
    let animId;
    if (panActive) {
      const pan = () => {
        setPlayer(prev => ({ ...prev, angle: prev.angle + 0.015 }));
        animId = requestAnimationFrame(pan);
      };
      animId = requestAnimationFrame(pan);
    }
    return () => cancelAnimationFrame(animId);
  }, [panActive]);
  const handleChoice = (choice) => {
    if (choice.requirement === 'Iron Key' && !inventory.includes('Iron Key')) return;
    if (choice.requirement === 'Metal Crowbar' && !inventory.includes('Metal Crowbar')) return;
    if (choice.requirement === 'Copper Wire' && !inventory.includes('Copper Wire')) return;
    if (choice.requirement === 'terminalRepaired' && !gameStateFlags.terminalRepaired) return;

    let nextX = player.x;
    let nextY = player.y;
    let nextAngle = player.angle;

    if (choice.action === 'start_pan') {
      setIsBlackout(true);
      setTimeout(() => {
        setIsBlackout(false);
        setIsLandscape(true);
        setPanActive(true); 
      }, 900);
      nextX = 6.5;
      nextY = 3.5;
    } else if (choice.action === 'trigger_meet') {
      setPanActive(false); 
      nextAngle = 0;       
    } else if (choice.action === 'knockout') {
      setIsBlackout(true);
      setTimeout(() => {
        setIsBlackout(false);
        setIsLandscape(false);
        setEscapePhase(true); 
      }, 1500);
      nextX = 3.5;
      nextY = 3.5;
      nextAngle = 0;
    } else if (choice.action === 'stop_pan_on_stand') {
      setPanActive(false); // Explicitly kills camera panorama rotation loop on stand up
      nextAngle = 0;       // Reset orientation cleanly to center straight look axis
    } else if (choice.action === 'escape_victory') {
      setIsLandscape(true); // Switches back onto clear open landscape background profiles
      nextX = 6.5;
      nextY = 3.5;
      nextAngle = 0;
    } else if (choice.action === 'get_key') {
      setInventory(prev => [...prev, 'Iron Key']);
      setGameStateFlags(prev => ({ ...prev, floorSearched: true }));
    } else if (choice.action === 'unlock_terminal') {
      setInventory(prev => prev.filter(item => item !== 'Iron Key'));
      setGameStateFlags(prev => ({ ...prev, terminalUnlocked: true }));
    } else if (choice.action === 'pry_vent') {
      setGameStateFlags(prev => ({ ...prev, ventOpened: true }));
    } else if (choice.action === 'get_wire') {
      setInventory(prev => [...prev, 'Copper Wire']);
    } else if (choice.action === 'get_crowbar') {
      setInventory(prev => [...prev, 'Metal Crowbar']);
    } else if (choice.action === 'repair_terminal') {
      setInventory(prev => prev.filter(item => item !== 'Copper Wire'));
      setGameStateFlags(prev => ({ ...prev, terminalRepaired: true }));
    } else if (choice.action === 'reset') {
      setIsBlackout(false);
      setIsLandscape(false);
      setPanActive(false);
      setEscapePhase(false);
      setPlayerName('');
      setPinInput('');
      setInventory([]);
      setGameStateFlags({
        floorSearched: false,
        cabinetUnlocked: false,
        ventOpened: false,
        terminalUnlocked: false,
        terminalRepaired: false
      });
      nextX = 3.5;
      nextY = 3.5;
      nextAngle = 0;
    }

    setPlayer({ x: nextX, y: nextY, angle: nextAngle });
    setCurrentNode(choice.nextNode);
  };

  const checkPadlockCode = () => {
    if (pinInput.trim() === '842') {
      setGameStateFlags(prev => ({ ...prev, cabinetUnlocked: true }));
      setPinInput('');
      setCurrentNode('cabinet_opened');
    } else {
      setPinInput('');
      alert('WRONG CODE. ACCESS DENIED.');
    }
  };

  const turnLeft = () => {
    if (panActive) return; 
    setPlayer(prev => ({ ...prev, angle: prev.angle - Math.PI / 2 }));
  };

  const turnRight = () => {
    if (panActive) return;
    setPlayer(prev => ({ ...prev, angle: prev.angle + Math.PI / 2 }));
  };
  // --- Game State Filter Overrides Interceptor Matrix ---
  let activeNodeKey = currentNode;
  if (activeNodeKey === 'floor_inspected' && gameStateFlags.floorSearched) activeNodeKey = 'floor_empty';
  if (activeNodeKey === 'west_cabinet' && gameStateFlags.cabinetUnlocked) activeNodeKey = 'cabinet_opened';
  if (activeNodeKey === 'cabinet_opened' && inventory.includes('Metal Crowbar')) activeNodeKey = 'cabinet_empty';
  if (activeNodeKey === 'south_vent' && gameStateFlags.ventOpened) activeNodeKey = 'vent_opened';
  if (activeNodeKey === 'vent_opened' && inventory.includes('Copper Wire')) activeNodeKey = 'vent_empty';
  if (activeNodeKey === 'north_terminal' && gameStateFlags.terminalUnlocked) activeNodeKey = 'terminal_unlocked';
  if (activeNodeKey === 'terminal_unlocked' && gameStateFlags.terminalRepaired) activeNodeKey = 'terminal_active';
  if (activeNodeKey === 'north_terminal' && gameStateFlags.terminalRepaired) activeNodeKey = 'terminal_active';

  const showLandscapeMesh = isLandscape || activeNodeKey === 'chase_scene' || activeNodeKey === 'counter_attack' || activeNodeKey === 'revenge_finale';

  const nodeData = STORY_NODES[activeNodeKey];
  const renderSlices = renderWolf3DView(player.x, player.y, player.angle, { isLandscape: showLandscapeMesh, escapePhase });
  const displayDialogueText = typeof nodeData.text === 'function' ? nodeData.text(playerName || 'Stranger') : nodeData.text;
  return (
    <View style={styles.container}>
      {/* TOP HALF: Raycasting Graphic Viewport */}
      <View style={styles.topViewport}>
        {!isBlackout ? (
          <Canvas style={styles.gameCanvas}>
            <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} color={showLandscapeMesh ? '#66b2ff' : '#050508'} />
            <Rect x={0} y={CANVAS_HEIGHT / 2} width={CANVAS_WIDTH} height={CANVAS_HEIGHT / 2} color={showLandscapeMesh ? '#00994c' : '#14141f'} />
            <Group>
              {renderSlices.map((slice, idx) => (
                <Rect key={idx} x={slice.x} y={slice.y} width={slice.w} height={slice.h} color={slice.color} />
              ))}
            </Group>
          </Canvas>
        ) : (
          <View style={styles.blackoutCover} />
        )}
      </View>
      {/* BOTTOM HALF: Story Dialogue, Inventory HUD, Inputs, and Step Controls */}
      <View style={styles.bottomInterfacePanel}>
        {/* Pack HUD Display Segment */}
        {escapePhase && activeNodeKey !== 'chase_scene' && activeNodeKey !== 'counter_attack' && activeNodeKey !== 'revenge_finale' && (
          <View style={styles.inventoryContainer}>
            <Text style={styles.inventoryTitle}>PACK:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.inventoryScroll}>
              {inventory.length === 0 ? (
                <Text style={styles.emptyInventoryText}>[ EMPTY PACK ]</Text>
              ) : (
                inventory.map((item, index) => (
                  <View key={index} style={styles.inventoryItemBadge}>
                    <Text style={styles.inventoryItemText}>🎒 {item}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* Story Text Streamer Panel Area */}
        <ScrollView style={styles.dialogueTextScroll}>
          <Text style={styles.dialogueText}>{displayDialogueText}</Text>
        </ScrollView>
        <View style={styles.interactionSection}>
          {/* Custom textual prompt form block */}
          {nodeData.input && (
            <View>
              <TextInput
                style={styles.nameInputField}
                placeholder="Type your name..."
                placeholderTextColor="#555577"
                value={playerName}
                onChangeText={setPlayerName}
              />
              <TouchableOpacity 
                disabled={!playerName.trim()}
                style={[styles.choiceButton, { opacity: playerName.trim() ? 1 : 0.5 }]} 
                onPress={() => setCurrentNode('confrontation')}
              >
                <Text style={styles.choiceButtonText}>Reply with your name</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Keycode numeric lock pad form box */}
          {nodeData.inputCode && (
            <View>
              <TextInput
                style={styles.nameInputField}
                placeholder="Enter 3-Digit Pin..."
                placeholderTextColor="#555577"
                keyboardType="numeric"
                maxLength={3}
                value={pinInput}
                onChangeText={setPinInput}
              />
              <TouchableOpacity 
                disabled={pinInput.length !== 3}
                style={[styles.choiceButton, { opacity: pinInput.length === 3 ? 1 : 0.5 }]} 
                onPress={checkPadlockCode}
              >
                <Text style={styles.choiceButtonText}>Submit Pin Sequence</Text>
              </TouchableOpacity>
            </View>
          )}

          {nodeData.choices.map((choice, index) => {
            const lockedKey = choice.requirement === 'Iron Key' && !inventory.includes('Iron Key');
            const lockedBar = choice.requirement === 'Metal Crowbar' && !inventory.includes('Metal Crowbar');
            const lockedWire = choice.requirement === 'Copper Wire' && !inventory.includes('Copper Wire');
            const lockedDoor = choice.requirement === 'terminalRepaired' && !gameStateFlags.terminalRepaired;
            const isChoiceLocked = lockedKey || lockedBar || lockedWire || lockedDoor;

            return (
              <TouchableOpacity 
                key={index} 
                disabled={isChoiceLocked}
                style={[styles.choiceButton, isChoiceLocked && styles.choiceButtonDisabled]} 
                onPress={() => handleChoice(choice)}
              >
                <Text style={[styles.choiceButtonText, isChoiceLocked && styles.choiceButtonTextDisabled]}>
                  {isChoiceLocked ? `[ LOCKED ] Requires ${choice.requirement}` : choice.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Bottom Layer 90-Degree Step Steering Buttons Row */}
        {!showLandscapeMesh && !isBlackout && currentNode !== 'intro' && currentNode !== 'examine_room' && (
          <View style={styles.turnOverlayContainer}>
            <TouchableOpacity style={styles.turnButton} onPress={turnLeft}>
              <Text style={styles.turnButtonText}>◀ TURN LEFT</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.turnButton} onPress={turnRight}>
              <Text style={styles.turnButtonText}>TURN RIGHT ▶</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.creditsContainer}>
          <Text style={styles.creditsText}>made by ThatGuyXim</Text>
        </View>
      </View>
    </View>
  );
}
