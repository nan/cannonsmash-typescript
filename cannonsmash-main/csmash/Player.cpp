/**
 * @file
 * @brief Implementation of Player class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000-2004, 2007  Kanna Yoshihiro
//
// This program is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA

#include "ttinc.h"
#include "Player.h"
#include "Ball.h"
#include "BaseView.h"
#include "Control.h"
#include "Event.h"
#include "PenAttack.h"
#include "PenDrive.h"
#include "ShakeCut.h"
#include "ComTrainingPenAttack.h"
#include "ComTrainingPenDrive.h"
#include "HitMark.h"
#include "PlayGame.h"
#include "Network.h"
#include "RCFile.h"
#ifdef LOGGING
#include "Logging.h"
#endif

#include "HumanController.h"
#include "TrainingHumanController.h"
#include "ComController.h"
#include "ComPenAttackController.h"
#include "ComPenDriveController.h"
#include "ComShakeCutController.h"
#include "ComTrainingPenAttackController.h"
#include "ComTrainingPenDriveController.h"

extern RCFile *theRC;

extern Ball   theBall;

extern long mode;

stype_t Player::stype;

const double playerAccelLimit[4] = {0.8, 0.7, 0.6, 0.5};
const double playerMaxForehandSpeed[6] = {15.0, 15.0, 25.0, 15.0, 15.0, 15.0};
const double playerMaxBackhandSpeed[6] = {12.0, 12.0, 18.0, 12.0, 12.0, 12.0};
const double playerDiffCoeff[6] = {1.0, 1.0, 1.0, 1.0, 1.0, 1.0};

const double playerServeParam[5][7] =
  {{SERVE_NORMAL,     0.0, 0.0,  0.0,  0.1,  0.0,  0.2},
   {SERVE_POKE,       0.0, 0.0,  0.0, -0.3,  0.0, -0.6},
   {SERVE_SIDESPIN1, -0.6, 0.2, -0.8,  0.0, -0.6, -0.2},
   {SERVE_SIDESPIN2,  0.6, 0.2,  0.8,  0.0,  0.6, -0.2},
   {-1,               0.0, 0.0,  0.0,  0.0,  0.0,  0.0}};

/***********************************************************************
 *	Class  Player
 ***********************************************************************/

/**
 * Default constructor.
 */
Player::Player() :
  m_x(0.0, -TABLELENGTH/2-0.2, 1.4),
  m_v(0.0, 0.0, 0.0),
  m_target(0.0, TABLELENGTH/16*5),
  m_eye(0.0, -1.0, 0.2),
  m_lookAt(0.0, TABLELENGTH/2, TABLEHEIGHT),
  m_spin(0.0, 0.0) {

  m_side = 1;
  m_playerType = PLAYER_PROTO;

  m_status = 200;
  m_swing = 0;
  m_afterSwing = 0;
  m_swingType = SWING_NORMAL;
  m_swingError = SWING_PERFECT;

  m_pow = 0;
  m_lookAt[1] *= m_side;
  m_stamina = 80.0;
  m_statusMax = 200;

  RUNSPEED = 2.0;
  RUNPENALTY = -1;
  SWINGPENALTY = -1;
  WALKSPEED = 1.0;
  WALKBONUS = 1;
  ACCELLIMIT = (double *)playerAccelLimit;
  ACCELPENALTY = -1;

  XDIFFPENALTY_FOREHAND = 0.15;
  XDIFFPENALTY_BACKHAND = 0.1;

  MAX_FOREHAND_SPEED = (double *)playerMaxForehandSpeed;
  MAX_BACKHAND_SPEED = (double *)playerMaxBackhandSpeed;
  FOREHAND_BOUNCE_RATE = 0.6;
  BACKHAND_BOUNCE_RATE = 0.6;
  FOREHAND_SPINEFFECT_RATE = 3.0;
  BACKHAND_SPINEFFECT_RATE = 4.0;

  DIFF_COEFF = (double *)playerDiffCoeff;

  AFTERSWING_PENALTY = 1.0;

  memcpy(SERVEPARAM, playerServeParam, sizeof(playerServeParam));

  m_View = NULL;
  m_controller = NULL;
}

/**
 * Constructor.
 * Set player side.
 *
 * @param side side of the player.
 */
Player::Player( long side ) :
  m_x(0.0, -TABLELENGTH/2-0.2, 1.4),
  m_v(0.0, 0.0, 0.0),
  m_target(0.0, TABLELENGTH/16*5),
  m_eye(0.0, -1.0, 0.2),
  m_lookAt(0.0, TABLELENGTH/2, TABLEHEIGHT),
  m_spin(0.0, 0.0) {

  m_side = side;
  if ( side < 0 ) {
    m_x[1] = -m_x[1];
    m_target[1] = -m_target[1];
    m_eye[1] = -m_eye[1];
  }

  m_playerType = PLAYER_PROTO;

  m_status = 200;
  m_swing = 0;
  m_afterSwing = 0;
  m_swingType = SWING_NORMAL;
  m_swingError = SWING_PERFECT;

  m_pow = 0;
  m_lookAt[1] *= m_side;
  m_stamina = 80.0;

  RUNSPEED = 2.0;
  RUNPENALTY = -1;
  SWINGPENALTY = -1;
  WALKSPEED = 1.0;
  WALKBONUS = 1;
  ACCELLIMIT = (double *)playerAccelLimit;
  ACCELPENALTY = -1;

  XDIFFPENALTY_FOREHAND = 0.15;
  XDIFFPENALTY_BACKHAND = 0.1;

  MAX_FOREHAND_SPEED = (double *)playerMaxForehandSpeed;
  MAX_BACKHAND_SPEED = (double *)playerMaxBackhandSpeed;
  FOREHAND_BOUNCE_RATE = 0.6;
  BACKHAND_BOUNCE_RATE = 0.6;
  FOREHAND_SPINEFFECT_RATE = 3.0;
  BACKHAND_SPINEFFECT_RATE = 4.0;

  DIFF_COEFF = (double *)playerDiffCoeff;

  AFTERSWING_PENALTY = 1.0;

  memcpy(SERVEPARAM, playerServeParam, sizeof(playerServeParam));

  m_View = NULL;
  m_controller = NULL;
}

/**
 * Constructor which specifies almost all member variables.
 *
 * @param playerType player type (pen attack, etc. )
 * @param side side (1 or -1)
 * @param x location of the player
 * @param v velocity of the player
 * @param status status of the player (0 - 200)
 * @param swing swing status of the player (0-50)
 * @param swingType type of swing (smash, cut, etc. )
 * @param swingSide side of swing (forehand or backhand)
 * @param afterSwing afterswing stop penalty
 * @param swingError valuation of the swing (good, bad, miss, etc. )
 * @param target location of the target
 * @param eye location of the camera
 * @param pow power to hit the ball
 * @param spin spin to hit the ball
 * @param stamina stamina (not used currently)
 * @param statusMax max of the status
 */
Player::Player( long playerType, long side, vector3d x, const vector3d v,
		long status, long swing, long swingType, bool swingSide, long afterSwing,
		long swingError, const vector2d target, const vector3d eye,
		const vector3d lookAt,
		long pow, const vector2d spin, double stamina,long statusMax,
		long dragX, long dragY ) {
  m_side = side;
  m_playerType = playerType;

  m_x = x;
  m_v = v;

  m_status = status;
  m_swing = swing;
  m_afterSwing = afterSwing;
  m_swingType = swingType;
  m_swingSide = swingSide;
  m_swingError = swingError;
  m_target = target;

  m_eye = eye;

  m_lookAt = lookAt;

  m_pow = pow;
  m_lookAt[1] *= m_side;
  m_spin = spin;
  m_stamina = stamina;
  m_statusMax = statusMax;

  RUNSPEED = 2.0;
  RUNPENALTY = -1;
  SWINGPENALTY = -1;
  WALKSPEED = 1.0;
  WALKBONUS = 1;
  ACCELLIMIT = (double *)playerAccelLimit;
  ACCELPENALTY = -1;

  XDIFFPENALTY_FOREHAND = 0.15;
  XDIFFPENALTY_BACKHAND = 0.1;

  MAX_FOREHAND_SPEED = (double *)playerMaxForehandSpeed;
  MAX_BACKHAND_SPEED = (double *)playerMaxBackhandSpeed;
  FOREHAND_BOUNCE_RATE = 0.6;
  BACKHAND_BOUNCE_RATE = 0.6;
  FOREHAND_SPINEFFECT_RATE = 3.0;
  BACKHAND_SPINEFFECT_RATE = 4.0;

  DIFF_COEFF = (double *)playerDiffCoeff;

  AFTERSWING_PENALTY = 1.0;

  memcpy(SERVEPARAM, playerServeParam, sizeof(playerServeParam));

  m_View = NULL;
  m_controller = NULL;
}

/**
 * Destructor.
 * Detach view class.
 */
Player::~Player() {
  if ( m_View ){
    BaseView::TheView()->RemoveView( m_View );
    delete m_View;
  }

  delete m_controller;
}

/**
 * Copy operator.
 */
void
Player::operator=(Player& p) {
  m_playerType = p.m_playerType;
  m_side = p.m_side;

  m_x = p.m_x;
  m_v = p.m_v;

  m_status = p.m_status;
  m_swing = p.m_swing;
  m_swingType = p.m_swingType;
  m_swingSide = p.m_swingSide;
  m_afterSwing = p.m_afterSwing;
  m_swingError = p.m_swingError;
  m_target = p.m_target;

  m_eye = p.m_eye;

  m_lookAt = p.m_lookAt;

  m_pow = p.m_pow;
  m_spin = p.m_spin;

  m_stamina = p.m_stamina;

  m_View = NULL;
}

/**
 * Creator method of subclasses of Player class.
 *
 * @param player player type
 * @param side player side
 * @param type class type of the player (normal, com, training, etc. )
 * @return returns created player object.
 */
Player*
Player::Create( long player, long side, long type ) {
  Player *newPlayer = NULL;
  Controller *newController = NULL;
  switch (player) {
  case PLAYER_PENATTACK:
    newPlayer = new PenAttack(side);
    break;
  case PLAYER_SHAKECUT:
    newPlayer = new ShakeCut(side);
    break;
  case PLAYER_PENDRIVE:
    newPlayer = new PenDrive(side);
    break;
  case PLAYER_PENATTACKTRAINER:
    newPlayer = new ComTrainingPenAttack(side);
    break;
  case PLAYER_PENDRIVETRAINER:
    newPlayer = new ComTrainingPenDrive(side);
    break;
  }

  switch (type) {
  case 0:	// normal
    newController = new HumanController(newPlayer);
    break;
  case 2:	// Training
    newController = new TrainingHumanController(newPlayer);
    break;
  case 1:	// Com
  case 3:	// ComTraining
    switch (player) {
    case PLAYER_PENATTACK:
      newController = new ComPenAttackController(newPlayer);
      break;
    case PLAYER_SHAKECUT:
      newController = new ComShakeCutController(newPlayer);
      break;
    case PLAYER_PENDRIVE:
      newController = new ComPenDriveController(newPlayer);
      break;
    case PLAYER_PENATTACKTRAINER:
      newController = new ComTrainingPenAttackController(newPlayer);
      break;
    case PLAYER_PENDRIVETRAINER:
      newController = new ComTrainingPenDriveController(newPlayer);
      break;
    }
    break;
  }

  if (newPlayer)
    newPlayer->setController(newController);

  return newPlayer;
  printf( _("no player %ld\n"), player );
  exit(1);
}

/**
 * Initializer method.
 * Create PlayerView object and attach it to this object.
 *
 * @return returns true if succeeds.
 */
bool
Player::Init() {
  m_View = (PlayerView *)View::CreateView( VIEW_PLAYER );

  m_View->Init( this );

  BaseView::TheView()->AddView( m_View );

  if ( theRC->gmode != GMODE_2D )
    HitMark::Init();

  //TODO merge to playerServeParam, etc.
  if ( stype.find(SWING_NORMAL) == stype.end() ) {
    stype[SWING_NORMAL]    = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SWING_POKE]      = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SWING_SMASH]     = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SWING_DRIVE]     = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SWING_CUT]       = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SWING_BLOCK]     = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SERVE_NORMAL]    = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SERVE_POKE]      = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SERVE_SIDESPIN1] = (struct swingType *)malloc(sizeof(struct swingType));
    stype[SERVE_SIDESPIN2] = (struct swingType *)malloc(sizeof(struct swingType));


	struct swingType swtNormal = {SWING_NORMAL,    -1, 10, 20, 20, 30, 50, 0.3, 0.0, 0.0};
	struct swingType swtPoke   = {SWING_POKE,      -1, 10, 20, 20, 30, 50, 0.3, 0.0, 0.0};
	struct swingType swtSmash  = {SWING_SMASH,     -1, 10, 20, 20, 30, 50, 0.3, 0.0, 0.0};	// Should be 10, 20, 70
	struct swingType swtDrive  = {SWING_DRIVE,     -1, 10, 20, 20, 30, 50, 0.3, 0.0, 0.0};	// Should be 10, 30, 80
	struct swingType swtCut    = {SWING_CUT,       -1, 10, 20, 20, 30, 50, 0.3, 0.0, 0.0};
	struct swingType swtBlock  = {SWING_BLOCK,     -1, 10, 20, 20, 30, 50, 0.3, 0.0, 0.0};	// Should be 5, 10, 30, 40
	struct swingType svtNormal = {SERVE_NORMAL,    1, 10, 20, 20, 30, 50, 0.3, 0.0, 2.5};	// Should be ?, 10, 30, 30, 40, 60
	struct swingType svtPoke   = {SERVE_POKE,      20, 85, 100, 100, 115, 200, 0.0, 0.0, 4.0};
	struct swingType svtSide1  = {SERVE_SIDESPIN1, 20, 60, 80, 80, 95, 150, 0.0, 0.0, 3.2};
	struct swingType svtSide2  = {SERVE_SIDESPIN2, 20, 80, 100, 100, 120, 200, 0.0, 0.0, 4.0};
    *stype[SWING_NORMAL]   = swtNormal;
    *stype[SWING_POKE]     = swtPoke;
    *stype[SWING_SMASH]    = swtSmash;
    *stype[SWING_DRIVE]    = swtDrive;
    *stype[SWING_CUT]      = swtCut;
    *stype[SWING_BLOCK]    = swtBlock;
    *stype[SERVE_NORMAL]   = svtNormal;
    *stype[SERVE_POKE]     = svtPoke;
    *stype[SERVE_SIDESPIN1]= svtSide1;
    *stype[SERVE_SIDESPIN2]= svtSide2;
  }

  return true;
}

void
Player::setController(Controller *controller) {
  if (m_controller)
    delete m_controller;
  m_controller = controller;
}

/**
 * Reset member variables.
 *
 * @param p player object. Member variables of the object is set to this object.
 * @return returns true if succeeds.
 */
bool
Player::Reset( Player *p ) {
  *this = *p;

  return true;
}

bool
Player::LoadPlayerLog( FILE *fp, long &sec, long &cnt ) {
  fscanf( fp,
	  "%ld.%ld: "
	  "playerType=%1ld side=%2ld x=%lf y=%lf z=%lf "
	  "vx=%lf vy=%lf vz=%lf status=%3ld "
	  "swing=%2ld swingType=%ld swingSide=%d afterSwing=%2ld "
	  "swingError=%1ld targetX=%lf targetY=%lf "
	  "eyeX=%lf eyeY=%lf eyeZ=%lf "
	  "lookAtX=%lf lookAtY=%lf lookAtZ=%lf "
	  "pow=%1ld spinX=%lf spinY=%lf stamina=%lf statusMax=%ld ",
	  &sec, &cnt,
	  &m_playerType, &m_side,
	  &(m_x[0]), &(m_x[1]), &(m_x[2]),
	  &(m_v[0]), &(m_v[1]), &(m_v[2]),
	  &m_status, &m_swing,
	  &m_swingType, &m_swingSide,
	  &m_afterSwing, &m_swingError,
	  &(m_target[0]), &(m_target[1]),
	  &(m_eye[0]), &(m_eye[1]), &(m_eye[2]),
	  &(m_lookAt[0]), &(m_lookAt[1]), &(m_lookAt[2]),
	  &m_pow, &(m_spin[0]), &(m_spin[1]),
	  &m_stamina, &m_statusMax );

  return true;
}


/**
 * Move this player object.
 * Move this player and change m_status.
 *
 * @param KeyHistory history of keyboard input
 * @param MouseXHistory history of mouse cursor move
 * @param MouseYHistory history of mouse cursor move
 * @param MouseBHistory history of mouse button push/release
 * @param Histptr current position of histories described above.
 * @return returns true if it is neccesary to redraw.
 */
bool
Player::Move( SDL_keysym *KeyHistory, long *MouseXHistory,
	      long *MouseYHistory, unsigned long *MouseBHistory,
	      int Histptr ) {
  vector3d prevV;
  prevV = m_v;

  // swing
  if ( m_swing > 0 ){
    if ( m_swing > stype[m_swingType]->swingEnd && m_afterSwing > 0 ) {
    //TODO:
    //if ( m_swing > START_FOLLOWTHROUGH && m_afterSwing > 0 ) {
      m_afterSwing--;
    } else {
#if 1
      if (canServe(&theBall)) {
	if ( theBall.GetV()[2] < 0 )
	  m_swing++;
      } else {
	if ( m_swing == stype[m_swingType]->backswing ) {
	//TODO:
	//if ( m_swing == END_BACKSWING ) {
	  if ( theBall.GetStatus() == -1 )
	    m_swing = 0;
	  else if ( ( m_side > 0 && theBall.GetStatus() == 0) ||
		    ( m_side < 0 && theBall.GetStatus() == 2) ) {
	    m_swing++;
	  }
	} else
	  m_swing++;
      }
#else
      //TODO apply delayed toss functionality.
      if (canServe(&theBall)) {
	m_swing++;
      } else {
	if ( m_swing == stype[m_swingType]->toss ) {
	  theBall.Toss(this, stype[m_swingType]->tossV);
	}

	if ( m_swing == stype[m_swingType]->backswing ) {
	//TODO:
	//if ( m_swing == END_BACKSWING ) {
	  if ( theBall.GetStatus() == -1 )
	    m_swing = 0;
	  else if ( ( m_side > 0 && theBall.GetStatus() == 0) ||
		    ( m_side < 0 && theBall.GetStatus() == 2) ) {
	    m_swing++;
	  }
	} else
	  m_swing++;
      }
#endif
    }
  }

  // If the ball goes out of sight, look at the ball direction
  MoveLookAt();

  // inpact
  if ( m_swing >= stype[m_swingType]->hitStart && m_swing <= stype[m_swingType]->hitEnd ) {
  //TODO:
  //if ( m_swing == START_HITBALL ) {
    HitBall();
    drawHitMark();

    //TODO: check whether this is necessary or not.
    //m_spin[0] = m_spin[1] = 0.0;
  }

  // end swing
  if ( m_swing == stype[m_swingType]->swingLength ) {
  //TODO:
  //if ( m_swing == END_FOLLOWTHROUGH ) {
    m_swing = 0;
    m_swingType = SWING_NORMAL;
  }

  // Automatically move towards the ball
  if ( (mode == MODE_SOLOPLAY || mode == MODE_MULTIPLAY ||
	mode == MODE_PRACTICE) && KeyHistory &&
       theRC->gameLevel != LEVEL_TSUBORISH ) {	  // Only for human.
    AutoMove();
  }

  // move player
  vector3d xNext = m_x + m_v*TICK;

  if ( xNext[0] < -AREAXSIZE/2 ){
    m_x[0] = -AREAXSIZE/2;
    m_v[0] = 0.0;
  } else if ( xNext[0] > AREAXSIZE/2 ){
    m_x[0] = AREAXSIZE/2;
    m_v[0] = 0.0;
  }
#ifndef DEBUG_NOLIMITMOVE
  else if ( m_x[0] <= -TABLEWIDTH/2 && xNext[0] >= -TABLEWIDTH/2 &&
	    m_x[1] > -TABLELENGTH/2+0.5 && m_x[1] < TABLELENGTH/2-0.5 ){
    m_x[0] = -TABLEWIDTH/2;
    m_v[0] = 0.0;
  }
  else if ( m_x[0] >= TABLEWIDTH/2 && xNext[0] <= TABLEWIDTH/2 &&
	    m_x[1] > -TABLELENGTH/2+0.5 && m_x[1] < TABLELENGTH/2-0.5 ){
    m_x[0] = TABLEWIDTH/2;
    m_v[0] = 0.0;
  }
#endif
  else
    m_x[0] = xNext[0];

  if ( xNext[1] < -AREAYSIZE/2 ) {
    m_x[1] = -AREAYSIZE/2;
    m_v[1] = 0.0;
  } else if ( xNext[1] > AREAYSIZE/2 ) {
    m_x[1] = AREAYSIZE/2;
    m_v[1] = 0.0;
  }
#ifndef DEBUG_NOLIMITMOVE
  else if ( m_x[1] <= -TABLELENGTH/2+0.5 && xNext[1] >= -TABLELENGTH/2+0.5
	    && m_x[0] > -TABLEWIDTH/2 && m_x[0] < TABLEWIDTH/2 ) {
    m_x[1] = -TABLELENGTH/2+0.5;
    m_v[1] = 0.0;
  }
  else if ( m_x[1] >= TABLELENGTH/2-0.5 && xNext[1] <= TABLELENGTH/2-0.5
	      && m_x[0] > -TABLEWIDTH/2 && m_x[0] < TABLEWIDTH/2 ) {
    m_x[1] = TABLELENGTH/2-0.5;
    m_v[1] = 0.0;
  }
#endif
  else
    m_x[1] = xNext[1];

  // Go back to the endline before serve
  if ( Control::TheControl()->IsPlaying() && theBall.GetStatus() == 8 &&
       ((PlayGame *)Control::TheControl())->GetService() == GetSide() ) {
#ifndef DEBUG_NOLIMITMOVE
    if ( m_side > 0 && m_x[1] > -TABLELENGTH/2 )
      m_x[1] = -TABLELENGTH/2;
    else if ( m_side < 0 && m_x[1] < TABLELENGTH/2 )
      m_x[1] = TABLELENGTH/2;
#endif
    if (m_swingType < SERVE_MIN)
      m_swingType = SERVE_MIN;
  }

  // Auto backswing
  if ( m_swing == 0 ) {
    Ball *tmpBall;

    tmpBall = new Ball(&theBall);

    for ( int i = 0 ; i < 30 ; i++ ) {	/* A bit earlier */
      tmpBall->Move();

      if ( ((tmpBall->GetStatus() == 3 && m_side == 1) ||
	    (tmpBall->GetStatus() == 1 && m_side == -1)) &&
	   (m_x[1]-tmpBall->GetX()[1])*m_side < 0.3 &&
	   (m_x[1]-tmpBall->GetX()[1])*m_side > -0.05 ){
	StartSwing(3);
	break;
      }
    }
    delete tmpBall;
  }

  m_controller->Move( KeyHistory, MouseXHistory, MouseYHistory, MouseBHistory,Histptr );

  // Calc status
  if ( m_v.len() > RUNSPEED)
    AddStatus(RUNPENALTY);

  if ( m_swing > stype[m_swingType]->backswing )
  //TODO:
  //if ( m_swing > END_BACKSWING )
    AddStatus(SWINGPENALTY);

  if ( m_v.len() < WALKSPEED ) {
    AddStatus(WALKBONUS);
  }

  if ( (m_v-prevV).len() > ACCELLIMIT[theRC->gameLevel] ) {
    AddStatus(ACCELPENALTY);
  }

  if ( theBall.GetStatus() == 8 || theBall.GetStatus() == -1 )
    ResetStatus();

  return true;
}

/**
 * Change status value.
 * diff is added to m_status.
 *
 * @param diff this value is added to m_status.
 * @return returns true if succeeds.
 */
bool
Player::AddStatus( long diff ) {
  m_status += diff;

  if ( m_status > m_statusMax )
    m_status = m_statusMax;

  if ( m_status < 1 ) {
    m_stamina += (m_status-1) / 10.0;
    m_status = 1;
  }

  // set status max
  if ( Control::TheControl()->GetThePlayer() == this ) {
    switch (theRC->gameLevel) {
    case LEVEL_EASY:
      m_statusMax += diff/5;
      break;
    case LEVEL_NORMAL:
      m_statusMax += diff/4;
      break;
    case LEVEL_HARD:
      m_statusMax += diff/3;
      break;
    case LEVEL_TSUBORISH:
      m_statusMax += diff/3;
      break;
    }
  } else {
    switch (theRC->gameLevel) {
    case LEVEL_EASY:
      m_statusMax += diff/3;
      break;
    case LEVEL_NORMAL:
      m_statusMax += diff/4;
      break;
    case LEVEL_HARD:
      m_statusMax += diff/5;
      break;
    case LEVEL_TSUBORISH:
      m_statusMax += diff/5;
      break;
    }
  }

  return true;
}

/**
 * Reset status value.
 */
void
Player::ResetStatus() {
  m_statusMax = STATUS_MAX;
  m_status = STATUS_MAX;
}

/**
 * Check whether this player swings forehand or backhand.
 *
 * @return if this player swings forhand, returns true. Otherwise returns false.
 */
bool
Player::ForeOrBack() {
  return GetSwingSide();
}

/**
 * Referring the relative location of player and the ball, this method checks the error level of hitting (perfect, good, miss, etc. )
 *
 * @return returns true if succeeds.
 */
bool
Player::SwingError() {
  double diff;

  if ( (m_x[1]-theBall.GetX()[1])*m_side < 0 )
    diff = fabs(m_x[1]-theBall.GetX()[1])/2;
  else
    diff = fabs(m_x[1]-theBall.GetX()[1]);

  if ( diff < 0.03 )
    m_swingError = SWING_PERFECT;
  else if ( diff < 0.1 )
    m_swingError = SWING_GREAT;
  else if ( diff < 0.2 )
    m_swingError = SWING_GOOD;
  else
    m_swingError = SWING_BOO;

  return true;
}

/**
 * Set location and velocity of the player.
 *
 * @param x location of the player
 * @param v velocity of the player
 * @return returns true if succeeds.
 */
bool
Player::Warp( const vector3d &x, const vector3d &v ) {
  m_x = x;
  m_v = v;

  return true;
}

/**
 * Set spin and swing of the player.
 *
 * @param pow power
 * @param spin spin
 * @param swingType swing type
 * @param swingSide forehand or backhand
 * @param swing swing status
 * @return returns true if succeeds.
 */
bool
Player::SetSwing(long pow, const vector2d &spin, long swingType,
		 bool swingSide, long swing) {
  m_pow = pow;
  m_spin = spin;
  m_swingType =swingType;
  m_swingSide =swingSide;
  m_swing = swing;

  return true;
}

// Target will be modified by the spin
// (now invalid)
#if 0
bool
Player::GetModifiedTarget( double &targetX, double &targetY ) {
  targetX = m_targetX;
  targetY = m_targetY + theBall.GetSpinY()*m_side*0.2;

  return true;
}
/**
 * Modify location of the target.
 *
 * @param target original target and modified target. [in, out]
 * @return returns true if succeeds.
 */
#else
bool
Player::GetModifiedTarget( vector2d &target ) {
  target = m_target;

  return true;
}
#endif

/**
 * Calculate the level of ball to be hit.
 * This method must be overridden.
 *
 * @param ball the ball object to be hit.
 * @param diff difference from ideal hit. [out]
 * @param level level of the hit. [out]
 * @param maxVy maximum ball speed of y-coodinate [out]
 */
void
Player::CalcLevel( Ball *ball, double &diff, double &level, double &maxVy ) {
  vector2d target;

  GetModifiedTarget( target );

  if ( ForeOrBack() )
    diff = fabs(m_x[1]-ball->GetX()[1])*XDIFFPENALTY_FOREHAND;
  else
    diff = fabs(m_x[1]-ball->GetX()[1])*XDIFFPENALTY_BACKHAND;

  diff *= fabs(ball->GetSpin()[1])+1;

  SwingError();

  /*
  level = 1 - fabs(target[1])/(TABLELENGTH/16)/40 -
    diff*DIFF_COEFF[m_swingType]*fabs(target[1])/(TABLELENGTH/16);
  */

  level = 1 - fabs(target[1])/(TABLELENGTH/16)*diff*DIFF_COEFF[m_swingType];

  level *= (double)m_pow/20.0 + 0.5;

  if ( ForeOrBack() ) {
    maxVy = hypot(ball->GetV()[0], ball->GetV()[1])*FOREHAND_BOUNCE_RATE +
      MAX_FOREHAND_SPEED[m_swingType] -
	(fabs(m_spin[1])+fabs(ball->GetSpin()[1]))*FOREHAND_SPINEFFECT_RATE;
  } else {
    maxVy = hypot(ball->GetV()[0], ball->GetV()[1])*BACKHAND_BOUNCE_RATE +
      MAX_BACKHAND_SPEED[m_swingType] -
	(fabs(m_spin[1])+fabs(ball->GetSpin()[1]))*BACKHAND_SPINEFFECT_RATE;
  }

  if ( level > 1.0 )
    level = 1.0;
}

/**
 * Start swing (backswing is already done).
 * This must be overridden.
 *
 * @param spin spin level. Currently this parameter is used for deciding forehand/backhand.
 * @return returns true if succeeds.
 */
bool
Player::Swing( long spin ) {
  Ball *tmpBall;

  if ( theBall.GetStatus() == 6 || theBall.GetStatus() == 7 )
    return false;

  if ( m_swing > stype[m_swingType]->backswing && m_swing < stype[m_swingType]->swingEnd )
  //TODO:
  //if ( m_swing > END_BACKSWING && m_swing < START_FOLLOWTHROUGH )
    return false;

  if ( m_swing >= stype[m_swingType]->swingEnd )
    AddStatus( -(stype[m_swingType]->swingLength-m_swing)*2 );
  //TODO:
  //if ( m_swing >= START_FOLLOWTHROUGH )
    //AddStatus( -(50-m_swing)*2 );

  m_swing = stype[m_swingType]->backswing+1;
  //TODO: maybe should use stype
  //m_swing = START_SWING;
  m_pow = 8;

  // Decide SwingType by the hit point and spin, etc.
  // Calc the ball location of 0.1 second later
  tmpBall = new Ball(&theBall);

  for ( int i = 0 ; i < 10 ; i++ )
    tmpBall->Move();

  if ( spin < 3 )
    m_swingSide = false;
  else
    m_swingSide = true;

  SwingType( tmpBall, spin );

  delete tmpBall;

  if (Control::TheControl()->GetThePlayer() == this && mode == MODE_MULTIPLAY)
    ::SendSwingAndLocation(this);

  return true;
}

/**
 * Start swing (backswing).
 * This method is called when the player starts backswing automatically.
 * This method checks whether this player can start backswing, and decide
 * swing type.
 *
 * @param spin spin level. Currently this parameter is used on serve only.
 * @return returns true if succeeds.
 */
bool
Player::StartSwing( long spin ) {
  Ball *tmpBall;

  if ( m_swing > stype[m_swingType]->backswing )
    return false;

  if ( m_swing == 0 ) {
    m_swing = 1;
    m_pow = 0;

    // Decide SwingType by the hit point and spin, etc.
    // Calc the ball location of 0.2 second later
    tmpBall = new Ball(&theBall);

    for ( int i = 0 ; i < 20 ; i++ )
      tmpBall->Move();

    if ( (m_x[0]-tmpBall->GetX()[0])*m_side > 0 )
      m_swingSide = false;
    else
      m_swingSide = true;

    SwingType( tmpBall, spin );

    delete tmpBall;
  }

  return true;
}

/**
 * Start serve (backswing).
 *
 * @param spin spin level.
 * @return returns true if succeeds.
 */
bool
Player::StartServe( long spin ) {
  double sparam[][7] = { {SERVE_NORMAL,     0.0, 0.0,  0.0,  0.1,  0.0,  0.2},
			 {SERVE_POKE,       0.0, 0.0,  0.0, -0.3,  0.0, -0.6},
			 {SERVE_SIDESPIN1, -0.6, 0.2, -0.8,  0.0, -0.6, -0.2},
			 {SERVE_SIDESPIN2,  0.6, 0.2,  0.8,  0.0,  0.6, -0.2},
			 {-1,               0.0, 0.0,  0.0,  0.0,  0.0,  0.0}};

  if ( m_swing > stype[m_swingType]->backswing )
    return false;

  if ( m_swing == 0 ){
    m_swing = 1;
    m_pow = 0;

    int i = 0;
    while ( sparam[i][0] > 0 ) {
      if ( (long)sparam[i][0] == m_swingType ) {
	m_spin[0] = sparam[i][(spin-1)*2+1];
	m_spin[1] = sparam[i][(spin-1)*2+2];
	break;
      }
      i++;
    }

    m_swingSide = true;

    if ( Control::TheControl()->GetThePlayer() == this &&
	 mode == MODE_MULTIPLAY )
      ::SendSwingAndLocation( this );
  }

  return true;
}

/**
 * Hit the ball with racket.
 * This method must be overridden.
 *
 * @return returns true if succeeds.
 */
bool
Player::HitBall() {
  vector3d v;
  double diff;
  double level;

  // Serve
  if (canServe(&theBall) &&
      fabs(m_x[0]-theBall.GetX()[0]) < 0.6 &&
      fabs(m_x[1]-theBall.GetX()[1]) < 0.3 ) {
    AddStatus( (long)-fabs(fabs(m_x[0]-theBall.GetX()[0])-0.3F)*100 );
    diff = fabs(m_x[1]-theBall.GetX()[1])*0.3;

    SwingError();

    if ( fabs(m_target[1]) < TABLELENGTH/16*2 )
      level = 0.95-diff*1.0;
    else if ( fabs(m_target[1]) < TABLELENGTH/16*4 )
      level = 0.93-diff*1.5;
    else if ( fabs(m_target[1]) < TABLELENGTH/16*6 )
      level = 0.90-diff*2.0;
    else
      level = 0.90-diff*2.0;

    theBall.TargetToVS( m_target, level, m_spin, v );

    theBall.Hit( v, m_spin, this );
  } else if (canHitBall(&theBall) &&
	     fabs(m_x[0]-theBall.GetX()[0]) < 0.6 &&
	     ((GetSwingSide() && (m_x[0]-theBall.GetX()[0])*m_side < 0 ) ||
	      (!GetSwingSide() && (m_x[0]-theBall.GetX()[0])*m_side > 0 )) &&
	     (m_x[1]-theBall.GetX()[1])*m_side < 0.3 &&
	     (m_x[1]-theBall.GetX()[1])*m_side > -0.6 ) {
    vector2d target;

    GetModifiedTarget( target );

    double maxVy;
    CalcLevel( &theBall, diff, level, maxVy );

    theBall.TargetToV( target, level, m_spin, v, 0.1, maxVy );

    AddError(v);

    // Reduce status
    m_afterSwing = (long)
      (hypot( theBall.GetV()[0]*0.8-v[0], theBall.GetV()[1]*0.8+v[1] )
       * (1.0+diff*10.0) + m_spin.len()*5.0 + fabs(theBall.GetSpin()[1])*4.0);

    m_afterSwing *= AFTERSWING_PENALTY;

    if ( ForeOrBack() || m_swingType == SWING_POKE )
      AddStatus( -m_afterSwing*2 );
    else
      AddStatus( -m_afterSwing*3 );

    if ( m_status == 1 )
      m_afterSwing *= 3;

    theBall.Hit( v, m_spin, this );
  } else {
    m_swingError = SWING_MISS;
  }

  m_spin[0] = m_spin[1] = 0.0;

  return true;
}

/**
 * Add error to volocity of the ball.
 * Referring the relative location of player and the ball, this method
 * add error to the velocity of the ball.
 *
 * @param v velocity of the ball [in, out]
 */
void
Player::AddError( vector3d &v ) {
  double vl;
  vector3d n1, n2;
  double radDiff, radRand;

#if 1
  double xDiff = (fabs(m_x[0]-theBall.GetX()[0])-0.3)/0.3;
  double yDiff = (m_x[1]-theBall.GetX()[1])/0.3;
  radDiff = hypot( xDiff*(1+fabs(theBall.GetSpin()[0])),
		   yDiff*(1+fabs(theBall.GetSpin()[1])) );
  //radDiff = sqrt( radDiff );
  radDiff *= (double)(200-m_status)/200*3.141592/12;
#else
  radDiff = (double)(200-m_status)/200*3.141592/12;
#endif

  vl = v.len();
  n1[0] =  v[1]/hypot(v[0], v[1]) * vl*tan(radDiff);
  n1[1] = -v[0]/hypot(v[0], v[1]) * vl*tan(radDiff);
  n1[2] = 0;
  n2[0] =             v[0]*v[2]/(vl*hypot(v[0], v[1])) * vl*tan(radDiff);
  n2[1] =             v[1]*v[2]/(vl*hypot(v[0], v[1])) * vl*tan(radDiff);
  n2[2] = (v[0]*v[0]+v[1]*v[1])/(vl*hypot(v[0], v[1])) * vl*tan(radDiff);

  // Hit the ball too fast --- net miss
  // Hit the ball too slow --- over miss
  if ( (m_x[1]-theBall.GetX()[1])*m_side < 0 )
    radRand = (RAND(180)+180)*3.141592/180.0;
  else
    radRand = RAND(180)*3.141592/180.0;

  v += n1*cos(radRand) + n2*sin(radRand);
}

/**
 * Referring the location of the target, calculate the border of the status.
 * If status point is less than the border, player will miss.
 *
 * @return returns border.
 */
long
Player::StatusBorder() {
  double nearEdge = TABLEWIDTH/2-fabs(m_target[0]);
  if ( TABLELENGTH/4-fabs(fabs(m_target[1])-TABLELENGTH/4) < nearEdge )
    nearEdge = TABLELENGTH/4-fabs(fabs(m_target[1])-TABLELENGTH/4);

  return (long)(50+(TABLELENGTH/4-nearEdge)*40);

}

/**
 * Returns dominant hand.
 *
 * @return returns true if the dominant hand is right. Otherwise returns false.
 */
bool
Player::GetDominantHand() {
  switch (m_playerType) {
  case PLAYER_PROTO:
  case PLAYER_PENATTACK:
  case PLAYER_SHAKECUT:
  case PLAYER_PENDRIVE:
    return true;
  }
  return false;
}

/**
 * Decide swing type.
 * Swing type is defined by the ball location and player type.
 *
 * @param ball the ball to be hit
 * @param spin spin of which the player intend to set.
 * @return returns true if succeeds
 */
bool
Player::SwingType( Ball *ball, long spin ) {
  return false;
}

/**
 * Toggle Serve type.
 * As the game player push space bar, serve type is changed into the next one.
 */
void
Player::ChangeServeType() {
  if ( theBall.GetStatus() == 8 &&
       ((PlayGame *)Control::TheControl())->GetService() == GetSide() ) {
    if ( m_swingType < SERVE_MIN )
      m_swingType = SERVE_MIN;
    else
      m_swingType++;

    if (m_swingType > SERVE_MAX)
      m_swingType = SERVE_MIN;
  }
}

/**
 * If the ball goes out of sight, look at the ball direction
 */
void
Player::MoveLookAt() {
  vector3d x = m_x + m_eye;
  vector3d tx; tx[0] = 0.0; tx[1] = TABLELENGTH/2*m_side; tx[2] = TABLEHEIGHT;
  vector3d vx1 = tx-x;
  vector3d vxt;
  vector3d vx2;
  double p, q;
  double sinP, cosP;

  vx1.normalize();

  vxt = theBall.GetX()-x;
  if ( theBall.GetStatus() == 6 || theBall.GetStatus() == 7 )
    vxt[2] = TABLEHEIGHT+0.15-x[2];

  vxt.normalize();

  if ( (cosP = vx1*vxt) < cos(3.141592/180.0*15) &&
       fabs(theBall.GetX()[1]) > fabs(x[1]) ) {
    sinP = sqrt(1-cosP*cosP);
    p = cos(3.141592/180.0*15) - sin(3.141592/180.0*15)*cosP/sinP;
    q = sin(3.141592/180.0*15)/sinP;

    vx2 = p*vxt+q*vx1;

    m_lookAt = x+vx2;
  } else {
    vector2d vx12; vx12[0] = vx1[1]; vx12[1] = vx1[2];
    vector2d vxt2; vxt2[0] = vxt[1]; vxt2[1] = vxt[2];
    if ( (cosP = (vx12*vxt2)/(vx12.len()*vxt2.len())) < cos(3.141592/180.0*15) &&
	 theBall.GetX()[2] > x[2] &&
	 (theBall.GetStatus() == 0 || theBall.GetStatus() == 2) ) {
      sinP = sqrt(1-cosP*cosP);
      p = cos(3.141592/180.0*15) - sin(3.141592/180.0*15)*cosP/sinP;
      q = sin(3.141592/180.0*15)/sinP;

      vx2 = p*vxt+q*vx1;

      m_lookAt = x+vx2;
    } else {
      m_lookAt = tx;
    }
  }
}

/**
 * Automatically move towards the ball.
 */
void
Player::AutoMove() {
  if ( m_swing > stype[m_swingType]->backswing && m_swing < stype[m_swingType]->hitStart ) {
  //TODO:
  //if ( m_swing > END_BACKSWING && m_swing < START_HITBALL ) {
    Ball *tmpBall;

    tmpBall = new Ball(&theBall);

    for ( int i = 0 ; i < stype[m_swingType]->hitStart-m_swing ; i++ )
    //TODO:
    //for ( int i = 0 ; i < 20-m_swing ; i++ )
      tmpBall->Move();

    if ( ((tmpBall->GetStatus() == 3 && m_side == 1) ||
	  (tmpBall->GetStatus() == 1 && m_side == -1)) ) {
      double hitpointX = m_swingSide ? m_x[0]+0.3*m_side : m_x[0]-0.3*m_side;
      double xdiff = tmpBall->GetX()[0] - (hitpointX+m_v[0]*(stype[m_swingType]->hitStart-m_swing)*TICK);
      double ydiff = tmpBall->GetX()[1] - (   m_x[1]+m_v[1]*(stype[m_swingType]->hitStart-m_swing)*TICK);
      //TODO:
      //double xdiff = tmpBall->GetX()[0] - (hitpointX+m_v[0]*(20-m_swing)*TICK);
      //double ydiff = tmpBall->GetX()[1] - (   m_x[1]+m_v[1]*(20-m_swing)*TICK);

      double vxdiff, vydiff;
      vxdiff = xdiff/TICK/(stype[m_swingType]->hitStart-m_swing);
      //TODO:
      //vxdiff = xdiff/TICK/(20-m_swing);

      if ( vxdiff > 2.0 )
	vxdiff = 2.0;
      else if ( vxdiff < -2.0 )
	vxdiff = -2.0;

      vxdiff /= theRC->gameLevel+1;

      m_v[0] += vxdiff;

      if ( fabs(ydiff) > 0.3 ) {
	vydiff = ydiff/TICK/(stype[m_swingType]->hitStart-m_swing);
	//TODO:
	//vydiff = ydiff/TICK/(20-m_swing);
	if ( vydiff > 2.0 )
	  vydiff = 2.0;
	else if ( vydiff < -2.0 )
	  vydiff = -2.0;

	vydiff /= theRC->gameLevel+1;

	m_v[1] += vydiff;
      }
    }
    delete tmpBall;
  }
}

bool
Player::canHitBall(Ball *ball) {
  if ( (ball->GetStatus() == 3 && m_side == 1) ||
       (ball->GetStatus() == 1 && m_side == -1) )
    return true;
  else
    return false;
}

bool
Player::canServe(Ball *ball) {
  if ( (ball->GetStatus() == 6 && m_side == 1) ||
       (ball->GetStatus() == 7 && m_side == -1) )
    return true;
  else
    return false;
}

void
Player::drawHitMark() {
  if ( Control::TheControl()->GetThePlayer() == this &&
       theRC->gmode != GMODE_2D ) {
    HitMark *hit;

    vector3d hitX = theBall.GetX();
    hitX[1] = m_x[1];

    hit = new HitMark();
    hit->Hit( hitX, theBall.GetV(), GetSwingError() );

    BaseView::TheView()->AddView( hit );
  }
}
