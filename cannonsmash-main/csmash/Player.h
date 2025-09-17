/**
 * @file
 * @brief Definition of Player class.
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

#ifndef _Player_
#define _Player_
#include "PlayerView.h"
#include "PlayerView2D.h"
#include "Controller.h"

#include <map>
#include <vector>
#include "matrix"
typedef Vector<3, double> vector3d;
typedef Vector<2, double> vector2d;

// m_playerType
#define PLAYER_PROTO		0	// Prototype player
#define PLAYER_PENATTACK	1	// Pen Attack
#define PLAYER_SHAKECUT		2	// Cut
#define PLAYER_PENDRIVE		3	// Pen Drive

#define PLAYER_PENATTACKTRAINER	1024
#define PLAYER_PENDRIVETRAINER	1025

// m_swingType
#define SWING_NORMAL	0	//
#define SWING_POKE	1	// push?
#define SWING_SMASH	2	//
#define SWING_DRIVE	3	//
#define SWING_CUT	4	//
#define SWING_BLOCK	5	//

#define SERVE_MIN	(65536)
#define SERVE_MAX	(SERVE_MIN+3)

#define SERVE_NORMAL	(SERVE_MIN+0)
#define SERVE_POKE	(SERVE_MIN+1)
#define SERVE_SIDESPIN1	(SERVE_MIN+2)
#define SERVE_SIDESPIN2	(SERVE_MIN+3)


class PlayerView;
class HitMark;
class Ball;
class Controller;

struct swingType {
  long type;
  long toss;
  long backswing;
  long hitStart;
  long hitEnd;
  long swingEnd;
  long swingLength;
  double hitX;
  double hitY;
  double tossV;
};

typedef std::map<long, struct swingType*> stype_t;

/**
 * Player class is a base class of player classes (PenAttack, PenDrive, etc.).
 */
class Player {
  friend class Howto;
  friend class Opening;
  friend class OpeningView;
public:
  Player();
  Player( long side );
  Player( long playerType, long side, const vector3d x, const vector3d v,
	  long status, long swing, long swingType, bool swingSide, long afterSwing,
	  long swingError, const vector2d target, const vector3d eye,
	  const vector3d lookAt,
	  long pow, const vector2d spin, double stamina, long statusMax,
	  long dragX, long dragY );

  virtual ~Player();

  void operator=(Player&);

  static Player* Create( long player, long side, long type );

  virtual bool Init();

  //virtual bool Reset( struct PlayerData *p );
  virtual bool Reset( Player *p );
  virtual bool LoadPlayerLog( FILE *fp, long &sec, long &cnt );

  virtual bool Move( SDL_keysym *KeyHistory, long *MouseXHistory,
		     long *MouseYHistory, unsigned long *MouseBHistory,
		     int Histptr );

  virtual bool AddStatus( long diff );
  virtual void ResetStatus();

  virtual View *GetView() { return m_View; }		///< Getter method of m_View

  virtual long   GetSide() { return m_side; }		///< Getter method of m_side
  virtual long   GetPlayerType() { return m_playerType; }///< Getter method of m_playerType

  virtual vector3d GetX() { return m_x; }		///< Getter method of m_x
  virtual vector3d GetV() { return m_v; }		///< Getter method of m_v
  virtual long   GetPower() { return m_pow; }		///< Getter method of m_pow
  virtual vector2d GetSpin() { return m_spin; }		///< Getter method of m_spin
  virtual vector2d GetTarget() { return m_target; }	///< Getter method of m_target
  virtual vector3d GetEye() { return m_eye; }		///< Getter method of m_eye
  virtual vector3d GetLookAt() { return m_lookAt; }	///< Getter method of m_lookAt
  virtual double GetStamina() { return m_stamina; }	///< Getter method of m_stamina
  virtual long   GetStatus() { return m_status; }	///< Getter method of m_status
  virtual long   GetStatusMax() { return m_statusMax; }	///< Getter method of m_statusMax
  virtual long   GetSwing() { return m_swing; }		///< Getter method of m_swing
  virtual long   GetSwingType() { return m_swingType; }	///< Getter method of m_swingType
  virtual bool   GetSwingSide() { return m_swingSide; }	///< Getter method of m_swingSide
  virtual long   GetSwingError() { return m_swingError; }///< Getter method of m_swingError
  virtual long   GetAfterSwing() { return m_afterSwing; }///< Getter method of m_afterSwing

  virtual void   SetV(vector3d v) { m_v = v; }		///< Setter method of m_v
  virtual void   SetTarget(vector2d target) { m_target = target; }	///< Setter method of m_target

  virtual Controller *GetController() { return m_controller; }	///< Getter method of m_controller

  virtual bool   GetDominantHand();

  // true  -> forehand
  // false -> backhand
  virtual bool ForeOrBack();

  virtual bool Warp( const vector3d &x, const vector3d &v );
  virtual bool SetSwing(long pow, const vector2d &spin, long swingType,
			bool swingSide, long swing);

  virtual bool GetModifiedTarget( vector2d &target );

  virtual void CalcLevel( Ball *ball, double &diff, double &level, double &maxVy );

  long StatusBorder();

  static stype_t stype;

  virtual void ChangeServeType();
  virtual bool Swing( long power );
  virtual bool StartSwing( long power );
  virtual bool StartServe( long spin );

  bool canHitBall(Ball *ball);
  bool canServe(Ball *ball);

protected:
  Controller *m_controller;	/**< An entity of which controls the player
				     (Human, com, network, etc.)
				*/

  long m_playerType;    ///< Player type
  long m_side;		/**< Player side
			 * <ul>
			 *  <li> 1  --- ( y < 0 )
			 *  <li> -1 --- ( y > 0 )
			 * </ul>
			 */

  vector3d m_x;		///< player location
  vector3d m_v;		///< player velocity

  long m_status;	///< status gauge
  long m_swing;		///< swing status
  long m_swingType;	///< swing type
  bool m_swingSide;	///< forehand or backhand
  long m_afterSwing;	///< after swing stop penalty
  long m_swingError;	/**< Error when hitting
			 * <ul>
			 *  <li> 0 --- Perfect
			 *  <li> 1 --- Great
			 *  <li> 2 --- Good
			 *  <li> 3 --- Boo
			 *  <li> 4 --- Miss
			 * </ul>
			 */
  vector2d m_target;	///< location of target circle

  vector3d m_eye;	///< camera location

  vector3d m_lookAt;	///< target of camera

  long m_pow;		///< power
  vector2d m_spin;	///< {sidespin, topspin/backspin}

  double m_stamina;	///< Not used

  long m_statusMax;	///< Max status value

  PlayerView* m_View;	///< Reference to view class

  virtual void setController(Controller *controller);

  virtual bool HitBall();
  virtual void drawHitMark();

  virtual bool SwingError();

  void UpdateLastSend();

  void AddError( vector3d &v );

  void MoveLookAt();
  void AutoMove();

  long RUNSPEED;	// Default: 2.0
  long RUNPENALTY;	// Default: -1
  long SWINGPENALTY;	// Default: -1
  long WALKSPEED;	// Default: 1.0
  long WALKBONUS;	// Default: 1
  double* ACCELLIMIT;	// Default: {0.8, 0.7, 0.6, 0.5}
  long ACCELPENALTY;	// Default: -1

  const static long STATUS_MAX = 200;

  double XDIFFPENALTY_FOREHAND;	//Default: 0.15
  double XDIFFPENALTY_BACKHAND;	//Default: 0.1

  double* MAX_FOREHAND_SPEED;	//Default: {15.0, 15.0, 25.0, 15.0, 15.0, 15.0}
  double* MAX_BACKHAND_SPEED;	//Default: {12.0, 12.0, 18.0, 12.0, 12.0, 12.0}
  double FOREHAND_BOUNCE_RATE;	//Default: 0.6
  double BACKHAND_BOUNCE_RATE;	//Default: 0.6
  double FOREHAND_SPINEFFECT_RATE;	//Default: 3.0
  double BACKHAND_SPINEFFECT_RATE;	//Default: 4.0

  double* DIFF_COEFF;		//Default: {1.0, 1.0, 1.0, 1.0, 1.0, 1.0}

  double AFTERSWING_PENALTY;	//Default: 1.0

  double SERVEPARAM[5][7];
    /*Default: { {SERVE_NORMAL,     0.0, 0.0,  0.0,  0.1,  0.0,  0.2},
		{SERVE_POKE,       0.0, 0.0,  0.0, -0.3,  0.0, -0.6},
		{SERVE_SIDESPIN1, -0.6, 0.2, -0.8,  0.0, -0.6, -0.2},
		{SERVE_SIDESPIN2,  0.6, 0.2,  0.8,  0.0,  0.6, -0.2},
		{-1,               0.0, 0.0,  0.0,  0.0,  0.0,  0.0}};
    */

private:
  virtual bool SwingType( Ball *ball, long spin );
};

#endif // _Player_
