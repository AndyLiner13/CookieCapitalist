// Desktop Editor Setup: ./.github/instructions/entities/manager_noesisOwnership.instructions.md

// #region 📋 README
// Server-side manager that assigns ownership of entities tagged with "noesis" to players.
// When a player joins the world, this script finds all entities with the "noesis" tag
// and transfers ownership to that player. This enables Shared execution mode scripts
// on Noesis UI panels to run on the player's client for optimal latency.
// #endregion

import { Component, Player, CodeBlockEvents, Entity, EntityTagMatchOperation } from "horizon/core";
import { Logger } from "./util_logger";

// #region 🏷️ Type Definitions
// Map to track which player owns which noesis entities
interface PlayerNoesisAssignment {
  player: Player;
  entities: Entity[];
}
// #endregion

class Default extends Component<typeof Default> {
  // #region ⚙️ Props
  static propsDefinition = {};
  // #endregion

  // #region 📊 State
  private log = new Logger("manager_noesisOwnership");
  
  // Track all noesis entities in the world
  private noesisEntities: Entity[] = [];
  
  // Track player assignments
  private playerAssignments: Map<number, PlayerNoesisAssignment> = new Map();
  // #endregion

  // #region 🔄 Lifecycle Events
  start(): void {
    const log = this.log.active("start");
    
    // Find all entities with the "noesis" tag
    this.noesisEntities = this.world.getEntitiesWithTags(
      ["noesis"],
      EntityTagMatchOperation.HasAnyExact
    );
    
    log.info(`Found ${this.noesisEntities.length} entities with 'noesis' tag`);
    
    // Listen for player enter/exit events
    this.connectCodeBlockEvent(
      this.entity,
      CodeBlockEvents.OnPlayerEnterWorld,
      this.onPlayerEnter.bind(this)
    );
    
    this.connectCodeBlockEvent(
      this.entity,
      CodeBlockEvents.OnPlayerExitWorld,
      this.onPlayerExit.bind(this)
    );
    
    // Assign ownership for any players already in the world
    const existingPlayers = this.world.getPlayers();
    for (const player of existingPlayers) {
      this.assignNoesisEntitiesToPlayer(player);
    }
    
    log.info("NoesisOwnership manager initialized");
  }
  // #endregion

  // #region 🎬 Handlers
  // Handle player entering the world
  private onPlayerEnter(player: Player): void {
    const log = this.log.active("onPlayerEnter");
    log.info(`Player entered: ${player.name.get()}`);
    
    this.assignNoesisEntitiesToPlayer(player);
  }
  
  // Handle player exiting the world
  private onPlayerExit(player: Player): void {
    const log = this.log.active("onPlayerExit");
    log.info(`Player exited: ${player.name.get()}`);
    
    // Remove player assignment
    const playerIndex = player.index.get();
    const assignment = this.playerAssignments.get(playerIndex);
    
    if (assignment) {
      // Transfer ownership back to server for entities this player owned
      const serverPlayer = this.world.getServerPlayer();
      for (const entity of assignment.entities) {
        try {
          entity.owner.set(serverPlayer);
        } catch (err) {
          log.warn(`Failed to transfer entity ownership back to server: ${err}`);
        }
      }
      
      this.playerAssignments.delete(playerIndex);
      log.info(`Released ${assignment.entities.length} entities from player`);
    }
    
    // Reassign noesis entities to remaining players
    this.redistributeNoesisEntities();
  }
  // #endregion

  // #region 🎯 Main Logic
  // Assign noesis entities to a specific player
  private assignNoesisEntitiesToPlayer(player: Player): void {
    const log = this.log.active("assignNoesisEntitiesToPlayer");
    
    const playerIndex = player.index.get();
    const playerName = player.name.get();
    
    // Skip server player
    if (player === this.world.getServerPlayer()) {
      log.info("Skipping server player");
      return;
    }
    
    // Get entities that are currently owned by server or need reassignment
    const entitiesToAssign = this.getUnassignedNoesisEntities();
    
    if (entitiesToAssign.length === 0) {
      log.info(`No unassigned noesis entities for player ${playerName}`);
      return;
    }
    
    // Assign entities to this player
    const assignedEntities: Entity[] = [];
    
    for (const entity of entitiesToAssign) {
      try {
        entity.owner.set(player);
        assignedEntities.push(entity);
        log.info(`Assigned entity '${entity.name.get()}' to player ${playerName}`);
      } catch (err) {
        log.error(`Failed to assign entity to player: ${err}`);
      }
    }
    
    // Track the assignment
    this.playerAssignments.set(playerIndex, {
      player,
      entities: assignedEntities,
    });
    
    log.info(`Assigned ${assignedEntities.length} noesis entities to player ${playerName}`);
  }
  
  // Get noesis entities that are not currently assigned to a player
  private getUnassignedNoesisEntities(): Entity[] {
    const log = this.log.inactive("getUnassignedNoesisEntities");
    
    const serverPlayer = this.world.getServerPlayer();
    const unassigned: Entity[] = [];
    
    for (const entity of this.noesisEntities) {
      const owner = entity.owner.get();
      
      // Entity is unassigned if owned by server
      if (owner === serverPlayer) {
        unassigned.push(entity);
      }
    }
    
    return unassigned;
  }
  
  // Redistribute noesis entities when a player leaves
  private redistributeNoesisEntities(): void {
    const log = this.log.active("redistributeNoesisEntities");
    
    const players = this.world.getPlayers();
    
    if (players.length === 0) {
      log.info("No players in world, entities remain with server");
      return;
    }
    
    // Get unassigned entities
    const unassigned = this.getUnassignedNoesisEntities();
    
    if (unassigned.length === 0) {
      log.info("No entities need redistribution");
      return;
    }
    
    // Assign to first available player
    // Could be enhanced to distribute evenly across players
    const targetPlayer = players[0];
    
    for (const entity of unassigned) {
      try {
        entity.owner.set(targetPlayer);
        
        // Update tracking
        const playerIndex = targetPlayer.index.get();
        const assignment = this.playerAssignments.get(playerIndex);
        if (assignment) {
          assignment.entities.push(entity);
        } else {
          this.playerAssignments.set(playerIndex, {
            player: targetPlayer,
            entities: [entity],
          });
        }
        
        log.info(`Redistributed entity '${entity.name.get()}' to player ${targetPlayer.name.get()}`);
      } catch (err) {
        log.error(`Failed to redistribute entity: ${err}`);
      }
    }
  }
  // #endregion

  // #region 🛠️ Helper Methods
  // Refresh the list of noesis entities (call if entities are spawned dynamically)
  public refreshNoesisEntities(): void {
    const log = this.log.active("refreshNoesisEntities");
    
    this.noesisEntities = this.world.getEntitiesWithTags(
      ["noesis"],
      EntityTagMatchOperation.HasAnyExact
    );
    
    log.info(`Refreshed: found ${this.noesisEntities.length} noesis entities`);
    
    // Reassign any new unassigned entities
    const players = this.world.getPlayers();
    if (players.length > 0) {
      this.redistributeNoesisEntities();
    }
  }
  // #endregion
}

Component.register(Default);
