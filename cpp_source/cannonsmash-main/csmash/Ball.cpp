/**
 * @file
 * @brief Implementation of Ball class.
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
#include "Ball.h"
#include "BaseView.h"
#include "Control.h"
#include "PlayGame.h"
#include "Sound.h"
#include "Event.h"
#include "RCFile.h"
#include "LobbyClient.h"

#ifdef LOGGING
#include "Logging.h"
#endif

extern RCFile *theRC;

extern Ball theBall;
extern long mode;

#if 0
inline double LOG(double f) { return log(f); }
#else
/**
 * Safety log(f)
 */
inline double LOG(double f)
{
    if (f <= 0) {
	printf("log(%g)!\n", f);
	return -10e10;
    } else {
	return log(f);
    }
}
#endif

/**
 * Default Constructor.
 */
Ball::Ball() : m_x(0.0), m_v(0.0), m_spin(0.0) {
  m_status = -1000;

  m_View = NULL;
}

/**
 * Constructs a ball of specified location, velocity, spin, status.
 *
 * @param _x location vector of the ball.
 * @param _v volocity vector of the ball.
 * @param _spin spin of the ball.
 * @param _status ball status
 */
Ball::Ball( const vector3d _x, const vector3d _v, const vector2d _spin, long _status ) {
  m_x = _x;
  m_v = _v;
  m_spin = _spin;
  m_status = _status;

  m_View = NULL;
}

/**
 * Constructs a copy of specified ball.
 *
 * @param ball ball object to be copied.
 */
Ball::Ball( Ball *ball ) {
  m_x = ball->m_x;
  m_v = ball->m_v;
  m_spin = ball->m_spin;
  m_status = ball->m_status;

  m_View = NULL;
}


/**
 * Destructs a ball.
 */
Ball::~Ball() {
  if ( m_View && &theBall == this ){
    BaseView::TheView()->RemoveView( m_View );
    delete m_View;
  }
}

/**
 * Initialize a Ball.
 * A BallView object is constructed and attached to this object.
 *
 * @return returns true if succeeds.
 */
bool
Ball::Init() {
  m_View = (BallView *)View::CreateView( VIEW_BALL );

  m_View->Init();
  BaseView::TheView()->AddView( m_View );

  return true;
}

/**
 * Move a ball.
 * Caluculate location/velocity/spin/status of the ball at TICK
 * second later.
 *
 * @return returns true if it is necessary to redraw.
 */
bool
Ball::Move() {
  vector3d oldX, oldV;
  vector2d oldSpin;

  // Return ball immidiately when ball dead
  if ( m_status < 0 )
    m_status--;

  if ( m_status < -100 || m_status == 8 ) {
    return Reset();
  }

  // Update velocity
  oldX = m_x;
  oldV = m_v;
  oldSpin = m_spin;

  // Vxy =  Vxy0*Rot(SpinX/PHY*(1-exp(-PHY*t)))*exp(-PHY*t)
  // Vz  = (Vz0+g/PHY)*exp(-PHY*t) - g/PHY

  double rot = oldSpin[0]/PHY-oldSpin[0]/PHY*exp(-PHY*TICK);
  m_v[0] = (oldV[0]*cos(rot) - oldV[1]*sin(rot))*exp(-PHY*TICK);
  m_v[1] = (oldV[0]*sin(rot) + oldV[1]*cos(rot))*exp(-PHY*TICK);
  m_v[2] = (oldV[2]+GRAVITY(oldSpin[1])/PHY)*exp(-PHY*TICK) - GRAVITY(oldSpin[1])/PHY;

  if ( oldSpin[0] == 0.0 ) {
    m_x[0] = oldX[0] + oldV[0]/PHY-oldV[0]/PHY*exp(-PHY*TICK);
    m_x[1] = oldX[1] + oldV[1]/PHY-oldV[1]/PHY*exp(-PHY*TICK);
  } else {
    //double theta = hypot(oldV[0], oldV[1])/PHY*(1-exp(-PHY*TICK))/(hypot(oldV[0], oldV[1])/oldSpin[0]);
    double theta = oldSpin[0]/PHY-oldSpin[0]/PHY*exp(-PHY*TICK);

    m_x[0] = oldV[1]/oldSpin[0]*cos(theta) - (-oldV[0]/oldSpin[0])*sin(theta) + oldX[0]-oldV[1]/oldSpin[0];
    m_x[1] = oldV[1]/oldSpin[0]*sin(theta) + (-oldV[0]/oldSpin[0])*cos(theta) + oldX[1]+oldV[0]/oldSpin[0];
  }

  m_x[2] = (PHY*oldV[2]+GRAVITY(oldSpin[1]))/(PHY*PHY)-(PHY*oldV[2]+GRAVITY(oldSpin[1]))/(PHY*PHY)*exp(-PHY*TICK) - GRAVITY(oldSpin[1])/PHY*TICK + oldX[2];

  m_spin[0] = oldSpin[0]*exp(-PHY*TICK);

  // Collision check
  CollisionCheck(oldX, oldV, oldSpin);

  return true;
}

/**
 * Hit the ball with racket.
 * Sets location/velocity of the ball after it is hit.
 *
 * @param v velocity vector of the ball.
 * @param spin spin of the ball.
 * @param player Player who hit the ball.
 * @return returns true if succeeds.
 */
bool
Ball::Hit( const vector3d v, const vector2d spin, Player *player ) {
  // Normal inpact
  if ( this == &theBall ) {
      Sound::TheSound()->Play( SOUND_RACKET, m_x );
  }

  m_spin = spin;

  m_v = v;

  // m_status should be updated by the information from the opponent
  if ( player == Control::TheControl()->GetComPlayer() &&
       mode == MODE_MULTIPLAY ) {
    return true;
  }

  if ( m_status == 6 )
    m_status = 4;
  else if ( m_status == 7 )
    m_status = 5;
  else if ( m_status == 3 )
    m_status = 0;
  else if ( m_status == 1 ) {
    m_status = 2;
  }

  return true;
}

/**
 * Toss the ball.
 * The ball is tossed up vertically, and the ball status is changed.
 *
 * @param player player who toss the ball.
 * @param power initial toss speed.
 * @return returns true if succeeds.
 */
bool
Ball::Toss( Player *player , double power ) {
//  m_v[2] = 2.5;
  m_v[2] = power;
  m_spin[0] = m_spin[1] = 0.0;

  if ( player->GetSide() > 0 )
    m_status = 6;
  else
    m_status = 7;

  return true;
}

/**
 * Ignoring physics, move the ball.
 * The ball location/velocity/spin/status is changed to specified value.
 *
 * @param x location
 * @param v velocity
 * @param spin spin
 * @param status ball status
 */
void
Ball::Warp( const vector3d x, const vector3d v, const vector2d spin, long status ) {
  m_x = x;
  m_v = v;
  m_spin = spin;

  m_status = status;
}

bool
Ball::LoadBallLog(FILE *fpBall, long &sec, long &cnt, long &score1, long &score2) {
  if (fscanf( fpBall, "%ld.%ld: %ld - %ld  x=%lf y=%lf z=%lf "
	      "vx=%lf vy=%lf vz=%lf "
	      "spinX=%lf spinY=%lf st=%ld\n",
	      &sec, &cnt,
	      &score1, &score2,
	      &(m_x[0]), &(m_x[1]), &(m_x[2]),
	      &(m_v[0]), &(m_v[1]), &(m_v[2]),
	      &(m_spin[0]), &(m_spin[1]),
	      &m_status ) == 13)
    return true;
  else return false;
}

/**
 * Calculate initial ball speed.
 * Return the ball speed to reach target.
 *
 * @param target The point where ball should bound
 * @param level hitting power(percentage)
 * @param spin ball spin
 * @param v velocity (return value)
 * @param vMin minimum velocity
 * @param vMax maximum velocity
 * @return returns true of succeeds.
 */
bool
Ball::TargetToV( vector2d target, double level, const vector2d spin,
		 vector3d &v, double vMin, double vMax ) {
  double t1, t2, z1;
  double vCurrent;
  vector2d x;

  x[0] = m_x[0]; x[1] = m_x[1];

  if ( target[1]*m_x[1] >= 0 ) {	// Never go over the net
    // t2 = time until ball reaches targetY
    t2 = getTimeToReachTarget( target-x, vMax*level*0.5, spin, v );

    // define vz which satisfy z=TABLEHEIGHT when t=t2
    v[2] = getVz0ToReachTarget(TABLEHEIGHT-m_x[2], spin, t2);

    return true;
  }

  while (vMax-vMin > 0.001) {
    vCurrent = (vMin+vMax)/2;

    // t2 = time until ball reaches targetY
    t2 = getTimeToReachTarget( target-x, vCurrent, spin, v );

    // t1 = time until ball reaches the net(y=0)
    double dummy;
    t1 = getTimeToReachY( dummy, 0, x, spin, v );

    // define vz which satisfy z=TABLEHEIGHT when t=t2
    v[2] = getVz0ToReachTarget(TABLEHEIGHT-m_x[2], spin, t2);

    // z1 = height of the ball when t=t1
    z1 = -(v[2]+GRAVITY(spin[1])/PHY)*exp(-PHY*t1)/PHY - GRAVITY(spin[1])*t1/PHY +
      (v[2]+GRAVITY(spin[1])/PHY)/PHY;

    if ( z1 < TABLEHEIGHT+NETHEIGHT-m_x[2] )
      vMax = vCurrent;
    else
      vMin = vCurrent;
  }

  vCurrent *= level;

  t2 = getTimeToReachTarget( target-x, vCurrent, spin, v );

  v[2] = getVz0ToReachTarget(TABLEHEIGHT-m_x[2], spin, t2);

  return true;
}

/**
 * Calculate initial ball speed of serve.
 * Return the ball speed to reach target.
 *
 * @param target The point where ball should bound
 * @param level hitting power(percentage)
 * @param spin ball spin
 * @param v velocity (return value)
 * @return returns true if succeeds.
 */
bool
Ball::TargetToVS( vector2d target, double level,
		  const vector2d spin, vector3d &v ) {
  vector2d bound;
  double boundX;
  vector3d tmpV = vector3d(0.0);
  vector2d sCurrent;
  vector2d x;
  x[0] = m_x[0]; x[1] = m_x[1];

  for ( bound[1] = -TABLELENGTH/2 ; bound[1] < TABLELENGTH/2 ; bound[1] += TICK ) {
    if ( bound[1]*m_x[1] <= 0.0 )
      continue;

    double vMin = 0.1;
    double vMax = 30.0;
    double vXY;
    vector3d vCurrent = vector3d();
    double t1, t2, t3;
    double z;

    while (vMax-vMin > 0.001) {
      vXY = (vMin+vMax)/2;

      double xMin = -TABLEWIDTH/2;
      double xMax =  TABLEWIDTH/2;

      while (xMax-xMin > 0.001) {
	bound[0] = (xMin+xMax)/2;
	sCurrent = spin;

	// t2 = time until the ball reaches bound
	t2 = getTimeToReachTarget( bound-x, vXY, sCurrent, vCurrent );

	// Calculate v just before the ball bounce
	double rotVx = vCurrent[0]*cos(sCurrent[0]*t2)-vCurrent[1]*sin(sCurrent[0]*t2);
	double rotVy = vCurrent[0]*sin(sCurrent[0]*t2)+vCurrent[1]*cos(sCurrent[0]*t2);

	vCurrent[0] = rotVx; vCurrent[1] = rotVy;
	vCurrent *= exp(-PHY*t2);
	sCurrent[0] *= exp(-PHY*t2);

	// Calculate v just after the ball bounce
	double vCurrentXY = hypot(vCurrent[0], vCurrent[1]);
	vCurrent[0] += vCurrent[0]/vCurrentXY*sCurrent[1]*0.8;
	vCurrent[1] += vCurrent[1]/vCurrentXY*sCurrent[1]*0.8;

	sCurrent[0] *= 0.95;
	sCurrent[1] *= 0.8;

	// t1 = time until the ball reaches target
	t1 = getTimeToReachY( boundX, target[1], bound, sCurrent, vCurrent );

	if ( boundX < target[0] )
	  xMin = bound[0];
	else
	  xMax = bound[0];
      }

      // define vz which satisfy z=TABLEHEIGHT when t=t2
      vCurrent[2] = getVz0ToReachTarget( TABLEHEIGHT-m_x[2], spin, t2 );

      // Bound
      vCurrent[2] = (vCurrent[2]+GRAVITY(spin[1])/PHY)*exp(-PHY*t2) - GRAVITY(spin[1])/PHY;
      vCurrent[2] *= -TABLE_E;

      z = -( vCurrent[2]+GRAVITY(spin[1]*0.8)/PHY)*exp(-PHY*t1)/PHY
	 - GRAVITY(spin[1]*0.8)/PHY*t1
	 + (vCurrent[2]+GRAVITY(spin[1]*0.8)/PHY)/PHY;

      if ( z > 0 )
	vMax = vXY;
      else
	vMin = vXY;
    }

    if ( fabs(z) > 0.01 )
      continue;

    t3 = getTimeToReachY( boundX, 0, bound, sCurrent, vCurrent );

    z = -( vCurrent[2]+GRAVITY(spin[1]*0.8)/PHY)*exp(-PHY*t3)/PHY
      - GRAVITY(spin[1]*0.8)/PHY*t3
      + (vCurrent[2]+GRAVITY(spin[1]*0.8)/PHY)/PHY;
    if ( z > NETHEIGHT+(1.0-level)*0.1 ) {	// temporary
      if ( vXY > hypot(tmpV[0], tmpV[1] ) ) {

	t2 = getTimeToReachTarget( bound-x, vXY, spin, tmpV );
	tmpV[2] = getVz0ToReachTarget( TABLEHEIGHT-m_x[2], spin, t2 );
      }
    }
  }

  v[0] = tmpV[0];
  v[1] = tmpV[1];
  v[2] = tmpV[2];

  return true;
}

/**
 * When the ball is dead, change the score and set the ball status dead.
 */
void
Ball::BallDead() {
  if ( m_status >= 0 ) {
    if ( Control::TheControl()->IsPlaying() && &theBall == this ) {
      ((PlayGame *)Control::TheControl())->ChangeScore();
    }

    m_status = -1;
  }
}

/**
 * Reset ball location and status.
 *
 * @return returns true if succeeds.
 */
bool
Ball::Reset() {
  PlayGame *control = (PlayGame *)Control::TheControl();

  if ( control->IsPlaying() ) {
    Player *player;

    if ( control->GetService() == control->GetThePlayer()->GetSide() )
      player = control->GetThePlayer();
    else
      player = control->GetComPlayer();

    if ( control->GetService() > 0 ) {
      m_x[0] = player->GetX()[0]+player->stype[player->GetSwingType()]->hitX;
      m_x[1] = player->GetX()[1]+player->stype[player->GetSwingType()]->hitY;
    } else {
      m_x[0] = player->GetX()[0]-player->stype[player->GetSwingType()]->hitX;
      m_x[1] = player->GetX()[1]+player->stype[player->GetSwingType()]->hitY;
    }

    m_x[2] = TABLEHEIGHT + 0.15;
    m_v[0] = m_v[1] = m_v[2] = 0.0;

    m_status = 8;

    if ( &theBall == this && control->IsGameEnd() == true ) {
      BaseView::TheView()->EndGame();
      ((PlayGame *)Control::TheControl())->EndGame();
    }

    // To Fix the possibility of score mismatch
  } else {
    m_x[0] = control->GetThePlayer()->GetX()[0]+0.3;
    m_x[1] = control->GetThePlayer()->GetX()[1];

    m_x[2] = TABLEHEIGHT + 0.15;
    m_v[0] = m_v[1] = m_v[2] = 0.0;

    m_status = 8;
  }

  return true;
}

/**
 * Check whether the ball bounces on the table, net or floor.
 * If it bounces, change location, velocity, status of the ball.
 *
 * @param x ball location of previous TICK.
 * @param v ball velocity of previous TICK.
 * @param spin ball spin of previous TICK.
 * @return returns true if succeeds.
 */
bool
Ball::CollisionCheck( vector3d &x, vector3d &v, vector2d &spin ) {
  double netT , tableT;        /* Flag for bound on the table, hit net */
  double tableY;               /* Hold y on bounding */

  if ( x[1]*m_x[1] <= 0.0 ) {
    netT = fabs( x[1]/((m_x[1]-x[1])/TICK) );
    if ( x[2]+(m_x[2]-x[2])*netT/TICK < TABLEHEIGHT ||
	 x[2]+(m_x[2]-x[2])*netT/TICK > TABLEHEIGHT+NETHEIGHT ||
	 x[0]+(m_x[0]-x[0])*netT/TICK < -TABLEWIDTH/2-NETHEIGHT ||
	 x[0]+(m_x[0]-x[0])*netT/TICK > TABLEWIDTH/2+NETHEIGHT )
      netT = TICK*100;
  } else {
    netT = TICK*100;
  }

  if ( (x[2]-TABLEHEIGHT)*(m_x[2]-TABLEHEIGHT) <= 0.0 ) {
    tableT = fabs( (x[2]-TABLEHEIGHT)/((m_x[2]-x[2])/TICK) );
    if ( tableT <= 0.0 || x[1]+(m_x[1]-x[1])*tableT/TICK < -TABLELENGTH/2 ||
	 x[1]+(m_x[1]-x[1])*tableT/TICK > TABLELENGTH/2 ||
	 x[0]+(m_x[0]-x[0])*tableT/TICK < -TABLEWIDTH/2 ||
	 x[0]+(m_x[0]-x[0])*tableT/TICK > TABLEWIDTH/2 )
      tableT = TICK*100;
  } else {
    tableT = TICK*100;
  }

  if ( netT < tableT ){	// Hit net
    m_v[0] *= 0.5;
    m_v[1] *= -0.2;
    m_spin *= -0.8;

    m_x[1] = m_v[1]*(TICK-netT);
  }

  if ( tableT < netT ){	// Bounce on the table
    if ( this == &theBall ) {
      Sound::TheSound()->Play( SOUND_TABLE, m_x );
    }
    tableY = x[1]+m_v[1]*tableT;
    if ( tableY < 0 ){		// Table of my side
      switch( m_status ){
      case 2:
	m_status = 3;
	break;
      case 4:
	m_status = 0;
	break;
      default:
	BallDead();
      }
    } else {			// Table of opponent side
      switch( m_status ) {
      case 0:
	m_status = 1;
	break;
      case 5:
	m_status = 2;
	break;
      default:
	BallDead();
      }
    }

    // before bounce
    vector3d bv;
    double rot;
    rot = spin[0]/PHY-spin[0]/PHY*exp(-PHY*tableT);
    bv[0] = (v[0]*cos(rot) - v[1]*sin(rot))*exp(-PHY*tableT);
    bv[1] = (v[0]*sin(rot) + v[1]*cos(rot))*exp(-PHY*tableT);
    bv[2] = (v[2]+GRAVITY(spin[1])/PHY)*exp(-PHY*tableT) - GRAVITY(spin[1])/PHY;

    if ( spin[0] == 0.0 ) {
      m_x[0] = x[0] + v[0]/PHY-v[0]/PHY*exp(-PHY*tableT);
      m_x[1] = x[1] + v[1]/PHY-v[1]/PHY*exp(-PHY*tableT);
    } else {
      //double theta = hypot(v[0], v[1])/PHY*(1-exp(-PHY*tableT))/(hypot(v[0], v[1])/spin[0]);
      double theta = spin[0]/PHY-spin[0]/PHY*exp(-PHY*tableT);

      m_x[0] = v[1]/spin[0]*cos(theta) - (-v[0]/spin[0])*sin(theta) + x[0]-v[1]/spin[0];
      m_x[1] = v[1]/spin[0]*sin(theta) + (-v[0]/spin[0])*cos(theta) + x[1]+v[0]/spin[0];
    }

    m_x[2] = (PHY*v[2]+GRAVITY(spin[1]))/(PHY*PHY)-(PHY*v[2]+GRAVITY(spin[1]))/(PHY*PHY)*exp(-PHY*tableT) - GRAVITY(spin[1])/PHY*tableT + x[2];

    m_spin[0] = spin[0]*exp(-PHY*tableT);

    // bounce
    m_spin[0] = spin[0]*0.95;
    m_spin[1] = spin[1]*0.8;

    double vXY = hypot(bv[0], bv[1]);
    bv[0] += bv[0]/vXY*m_spin[1];
    bv[1] += bv[1]/vXY*m_spin[1];
    bv[2] *= -TABLE_E;

    // after bounce
    rot = m_spin[0]/PHY-m_spin[0]/PHY*exp(-PHY*(TICK-tableT));
    m_v[0] = (bv[0]*cos(rot) - bv[1]*sin(rot))*exp(-PHY*(TICK-tableT));
    m_v[1] = (bv[0]*sin(rot) + bv[1]*cos(rot))*exp(-PHY*(TICK-tableT));
    m_v[2] = (bv[2]+GRAVITY(m_spin[1])/PHY)*exp(-PHY*(TICK-tableT)) - GRAVITY(m_spin[1])/PHY;

    if ( m_spin[0] == 0.0 ) {
      m_x[0] = m_x[0] + bv[0]/PHY-bv[0]/PHY*exp(-PHY*(TICK-tableT));
      m_x[1] = m_x[1] + bv[1]/PHY-bv[1]/PHY*exp(-PHY*(TICK-tableT));
    } else {
      //double theta = hypot(bv[0], bv[1])/PHY*(1-exp(-PHY*(TICK-tableT)))/(hypot(bv[0], bv[1])/m_spin[0]);
      double theta = m_spin[0]/PHY-m_spin[0]/PHY*exp(-PHY*(TICK-tableT));

      m_x[0] = bv[1]/m_spin[0]*cos(theta) - (-bv[0]/m_spin[0])*sin(theta) + m_x[0]-bv[1]/m_spin[0];
      m_x[1] = bv[1]/m_spin[0]*sin(theta) + (-bv[0]/m_spin[0])*cos(theta) + m_x[1]+bv[0]/m_spin[0];
    }

    m_x[2] = (PHY*bv[2]+GRAVITY(m_spin[1]))/(PHY*PHY)-(PHY*bv[2]+GRAVITY(m_spin[1]))/(PHY*PHY)*exp(-PHY*(TICK-tableT))
      - GRAVITY(m_spin[1])/PHY*(TICK-tableT) + m_x[2];

    m_spin[0] = m_spin[0]*exp(-PHY*(TICK-tableT));

    return true;
  }

  /* Collision check with walls */
  if ( m_x[0] < -AREAXSIZE/2 ){
    m_x[0] = -AREAXSIZE/2;
    m_v[0] = -m_v[0]*TABLE_E/2;
    if ( this == &theBall ) {
      Sound::TheSound()->Play( SOUND_TABLE, m_x );
    }
    BallDead();
  } else if ( m_x[0] > AREAXSIZE/2 ){
    m_x[0] = AREAXSIZE/2;
    m_v[0] = -m_v[0]*TABLE_E/2;
    if ( this == &theBall ) {
      Sound::TheSound()->Play( SOUND_TABLE, m_x );
    }
    BallDead();
  }

  if ( m_x[1] < -AREAYSIZE/2 ){
    m_x[1] = -AREAYSIZE/2;
    m_v[1] = -m_v[1]*TABLE_E/2;
    if ( this == &theBall ) {
      Sound::TheSound()->Play( SOUND_TABLE, m_x );
    }
    BallDead();
  } else if ( m_x[1] > AREAYSIZE/2 ){
    m_x[1] = AREAYSIZE/2;
    m_v[1] = -m_v[1]*TABLE_E/2;
    if ( this == &theBall ) {
      Sound::TheSound()->Play( SOUND_TABLE, m_x );
    }
    BallDead();
  }

  if ( m_x[2] < 0 ){
    m_x[2] = 0;
    m_v[2] = -m_v[2]*TABLE_E;
    if ( m_v[1] > 0 )
      m_v[1] += m_spin[1]*0.8;
    else
      m_v[1] -= m_spin[1]*0.8;

    if ( this == &theBall ) {
      Sound::TheSound()->Play( SOUND_TABLE, m_x );
    }
    BallDead();
  } else if ( m_x[2] > AREAZSIZE ){
    m_x[2] = AREAZSIZE;
    m_v[2] = -m_v[2]*0.1;
    if ( this == &theBall ) {
      Sound::TheSound()->Play( SOUND_TABLE, m_x );
    }
    BallDead();
  }

  return true;
}

/**
 * Calculate time the ball reaches the target.
 *
 * @param target relative location of the target from current ball position.
 * @param velocity velocity(absolute) of the ball.
 * @param spin spin of the ball.
 * @param v velocity of the ball.
 * @return returns time when the ball reaches the target.
 */
double
Ball::getTimeToReachTarget( vector2d target, double velocity, vector2d spin, vector3d &v ) {
  if ( spin[0] == 0.0 ) {
    v[0] = target[0]/target.len()*velocity;
    v[1] = target[1]/target.len()*velocity;

    if ( 1-PHY*target.len()/velocity < 0 ) {	// Never reaches the target
      return 100000;
    }
    return -LOG(1-PHY*target.len()/velocity)/PHY;
  } else {
    double theta = asin(target.len()*spin[0]/(2*velocity));
    v[0] = target[0]/target.len()*velocity*cos(-theta) - target[1]/target.len()*velocity*sin(-theta);
    v[1] = target[0]/target.len()*velocity*sin(-theta) + target[1]/target.len()*velocity*cos(-theta);

    if ( 1-2*PHY/spin[0]*theta < 0 ) {	// Never reaches the target
      return 100000;
    }
    return -LOG(1-2*PHY/spin[0]*theta)/PHY;
  }
}

/**
 * Calculate time when x[1] of the ball becomes targetY.
 *
 * @param targetX x[0] when x[1] becomes y. [out]
 * @param targetY y of the target.
 * @param x current ball location.
 * @param spin spin of the ball.
 * @param v velocity of the ball.
 * @return returns time when x[1] of the ball becomes targetY.
 */
double
Ball::getTimeToReachY( double &targetX, double targetY, vector2d x, vector2d spin, vector3d v ) {
  vector2d target;
  v[2] = 0.0;

  if ( spin[0] == 0.0 ) {
    target[0] = x[0]+v[0]/v[1]*(targetY-x[1]);
    target[1] = targetY;

    targetX = target[0];

    return getTimeToReachTarget( target-x, v.len(), spin, v );
  } else {
    vector2d centerX, yTarget;
    double ip;

    centerX[0] = x[0] - v[1]/spin[0];
    centerX[1] = x[1] + v[0]/spin[0];

    yTarget[0] = centerX[0] +
      sqrt( -(targetY-centerX[1])*(targetY-centerX[1]) + v.len2()/(spin[0]*spin[0]));
    yTarget[1] = targetY;

    ip = (x-centerX)*(yTarget-centerX);

    yTarget[0] = centerX[0] -
      sqrt( -(targetY-centerX[1])*(targetY-centerX[1]) + v.len2()/(spin[0]*spin[0]));
    yTarget[1] = targetY;

    if ( ip > (x-centerX)*(yTarget-centerX) ) {
      yTarget[0] = centerX[0] +
	sqrt( -(targetY-centerX[1])*(targetY-centerX[1]) + v.len2()/(spin[0]*spin[0]));
    } else {
      //yTarget[0] = centerX[0] -
      //sqrt( -(targetY-centerX[1])*(targetY-centerX[1]) + v.len2()/(spin[0]*spin[0]));
    }

    targetX = yTarget[0];

    return getTimeToReachTarget( yTarget-x, v.len(), spin, v );
  }
}

/**
 * Calculate vz which satisfy z=target when time=t.
 *
 * @param targetHeight relative height of the target from current position.
 * @param spin ball spin.
 * @param t time when height=targetHeight
 * @return returns initial vz which satisfy z=target when time=t.
 */
double
Ball::getVz0ToReachTarget( double targetHeight, vector2d spin, double t ) {
  if ( t != 0.0 ) {
    return (PHY*targetHeight+GRAVITY(spin[1])*t)/(1-exp(-PHY*t)) - GRAVITY(spin[1])/PHY;
  } else {	// Invalid time
    return -targetHeight;
  }
}
