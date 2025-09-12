/**
 * @file
 * @brief Implementation of PenAttack class.
 * @author KANNA Yoshihiro
 * @version $Id$
 */

// Copyright (C) 2000-2004, 2007  神南 吉宏(Kanna Yoshihiro)
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
#include "PenAttack.h"
#include "Ball.h"
#include "Event.h"
#include "Network.h"
#include "Control.h"
#include "RCFile.h"

extern RCFile *theRC;

extern Ball   theBall;

extern long mode;

/**
 * Default constructor.
 * Set player type to pen attack.
 */
PenAttack::PenAttack() {
  m_playerType = PLAYER_PENATTACK;
}

/**
 * Constructor.
 * Set player type and side.
 *
 * @param side side of the player.
 */
PenAttack::PenAttack(long side) : Player(side) {
  m_playerType = PLAYER_PENATTACK;
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
PenAttack::PenAttack( long playerType, long side, const vector3d x,
		      const vector3d v, long status, long swing,
		      long swingType, bool swingSide, long afterSwing,
		      long swingError, const vector2d target,
		      const vector3d eye, const vector3d lookAt,
		      long pow, const vector2d spin, double stamina,
		      long statusMax, long dragX, long dragY ) :
  Player( playerType, side, x, v, status, swing, swingType, swingSide,
	  afterSwing, swingError, target, eye, lookAt, pow, spin,
	  stamina, statusMax, dragX, dragY ) {
}

/**
 * Destructor.
 * Do nothing.
 */
PenAttack::~PenAttack() {
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
PenAttack::SwingType( Ball *ball, long spin ) {
  m_spin[0] = 0.0;
  if (canHitBall(ball)) {
    if ( fabs(ball->GetX()[0]) < TABLEWIDTH/2 &&
	 fabs(ball->GetX()[1]) < TABLELENGTH/2 &&
	 (ball->GetX()[2]-TABLEHEIGHT-NETHEIGHT)/fabs(ball->GetX()[1]) <
	 NETHEIGHT/(TABLELENGTH/2)*0.5 ) {	// low ball on the table
      if ( ball->GetSpin()[1] < 0 ){
	m_swingType = SWING_POKE;
	//m_spin = -spin*0.2-0.4;
	m_spin[1] = -0.8;
      } else{
	m_swingType = SWING_NORMAL;
	//m_spin = spin*0.2;
	m_spin[1] = 0.4;
      }
    } else if ( ball->GetX()[2] < TABLEHEIGHT+NETHEIGHT ) { // under the net
      if ( ForeOrBack() ) {
	m_swingType = SWING_DRIVE;
	//m_spin = spin*0.2+0.4;
	m_spin[1] = 0.8;
      } else {
	if ( ball->GetSpin()[1] < 0 ) {
	  m_swingType = SWING_POKE;
	  //m_spin = -spin*0.2-0.4;
	  m_spin[1] = -0.8;
	} else {
	  m_swingType = SWING_NORMAL;
	  //m_spin = spin*0.2;
	  m_spin[1] = 0.4;
	}
      }
    } else if ( fabs(ball->GetX()[1]) < TABLELENGTH/2+1.0 &&
		ball->GetX()[2] > TABLEHEIGHT+NETHEIGHT ){
      m_swingType = SWING_SMASH;
      m_spin[1] = 0.2;
    } else {
      m_swingType = SWING_NORMAL;
      //m_spin = spin*0.2;
      m_spin[1] = 0.4;
    }
  } else{
    m_swingType = SWING_NORMAL;
    //m_spin = spin*0.2;
    m_spin[1] = 0.4;
  }

  return true;
}
