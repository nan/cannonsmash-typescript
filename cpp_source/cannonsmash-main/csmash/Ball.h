/**
 * @file
 * @brief Definition of Ball class.
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

#ifndef _Ball_
#define _Ball_

#include "BallView.h"
#include "BallView2D.h"
#include "Player.h"

#include <vector>
#include "matrix"
typedef Vector<3, double> vector3d;
typedef Vector<2, double> vector2d;

/**
 * Ball class.
 */
class Ball {
  friend class Opening;
public:
  Ball();
  Ball( const vector3d _x, const vector3d _vx, const vector2d _spin, long _status );
  Ball(Ball *ball);

  virtual ~Ball();

  virtual bool Init();

  /**
   * Returns the location vector of this object.
   */
  vector3d GetX() { return m_x; }

  /**
   * Returns the velocity vector of this object.
   */
  vector3d GetV() { return m_v; }

  /**
   * Returns the spin of this object.
   */
  vector2d GetSpin() { return m_spin; }

  /**
   * Returns the status of this object.
   */
  long GetStatus() { return m_status; }

  bool Move();

  bool Hit( const vector3d v, const vector2d spin, Player *player );
  bool Toss( Player *player, double power );

  void Warp( const vector3d x, const vector3d v, const vector2d spin, long status );

  bool LoadBallLog(FILE *fpBall, long &sec, long &cnt, long &score1, long &score2);


  bool TargetToV( vector2d target, double level, const vector2d spin,
		  vector3d &v, double vMin = 0.1, double vMax = 30.0 );
  bool TargetToVS( vector2d target, double level,
		   const vector2d spin, vector3d &v );

  void BallDead();
  /**
   * Returns the BallView object attached to this object.
   */
  BallView *GetView() { return m_View; };
protected:
  vector3d m_x;		///< location vector
  vector3d m_v;		///< velocity vector
  vector2d m_spin;	/**< spin vector
			 *   <ul>
			 *     <li> spin[0]
			 *       <ul>
			 *         <li> plus  --- ball moves to right
			 *         <li> minus --- ball moves to left
			 *       </ul>
			 *     <li> spin[1]
			 *       <ul>
			 *         <li>  plus  --- top spin\n
			 *         <li>  minus --- back spin
			 *       </ul>
			 *   </ul>
			 */
  long m_status;	/**< ball status
			 *   <ul>
			 *     <li> 0 --- From the time side=1 hit to bound
			 *     <li> 1 --- During side=-1 can hit
			 *     <li> 2 --- From the time side=-1 hit to bound
			 *     <li> 3 --- During side=1 can hit
			 *     <li> 4 --- From the time side=1 serve to bound
			 *     <li> 5 --- From the time side=-1 serve to bound
			 *     <li> 6 --- From the time side=1 toss to hit
			 *     <li> 7 --- From the time side=-1 toss to hit
			 *     <li> 8 --- Until player serve
			 *     <li> -1 --- Ball dead
			 *   </ul>
			 */

  BallView* m_View;	///< BallView object attached to this object

private:
  bool Reset();
  bool CollisionCheck(vector3d &x, vector3d &v, vector2d &spin);
  double getTimeToReachTarget( vector2d target, double velocity, vector2d spin, vector3d &v );
  double getTimeToReachY( double &targetX, double targetY, vector2d x, vector2d spin, vector3d v );
  double getVz0ToReachTarget( double targetHeight, vector2d spin, double t );

};

#endif // _Ball_
